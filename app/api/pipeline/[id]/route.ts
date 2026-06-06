import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createNotification } from '@/lib/notifications'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { data, error } = await supabaseAdmin
      .from('pipeline')
      .select(`
        *,
        job_descriptions (*),
        candidates (*)
      `)
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[api/pipeline/[id] GET]', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { stage, updated_by } = body

    // 기존 파이프라인 데이터 조회
    const { data: oldPipeline } = await supabaseAdmin
      .from('pipeline')
      .select(`
        *,
        job_descriptions (id, position, created_by, organization_id),
        candidates (id, name)
      `)
      .eq('id', id)
      .single()

    // Stage Gate: Searcher는 "제안" 단계까지만 변경 가능
    if (stage && updated_by) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, id, full_name')
        .eq('email', updated_by)
        .single()

      if (profile && profile.role === 'searcher') {
        const restrictedStages = ['클라이언트 제출', '1차 면접', '2차 면접', '최종 면접', '합격', '탈락', 'submitted', 'interview', 'offer', 'hired', 'rejected']
        if (restrictedStages.some(s => stage.toLowerCase().includes(s.toLowerCase()))) {
          return NextResponse.json(
            { error: 'Searcher는 "제안" 단계까지만 진행할 수 있습니다. PM 또는 Owner에게 문의하세요.' },
            { status: 403 }
          )
        }
      }

      // 단계 변경 시 알림 생성
      if (oldPipeline && stage && stage !== oldPipeline.stage) {
        const jd = oldPipeline.job_descriptions as any
        const candidate = oldPipeline.candidates as any

        // 1. JD 담당자(PM)에게 알림 - 자신의 JD인 경우만
        if (jd?.created_by && profile) {
          const { data: jdOwner } = await supabaseAdmin
            .from('profiles')
            .select('id, role')
            .eq('email', jd.created_by)
            .single()

          // PM/Owner가 자신의 JD이고, 본인이 변경한 것이 아니면 알림
          if (jdOwner && jdOwner.id !== profile.id && (jdOwner.role === 'headhunter' || jdOwner.role === 'owner')) {
            await createNotification({
              userId: jdOwner.id,
              type: 'pipeline_stage',
              title: `파이프라인 단계 변경: ${candidate?.name || '후보자'}`,
              message: `${jd.position} 포지션의 "${candidate?.name || '후보자'}" 단계가 "${oldPipeline.stage}" → "${stage}"로 변경되었습니다.`,
              relatedId: id,
              relatedType: 'pipeline',
              actionUrl: `/pipeline`,
              senderId: profile.id,
              senderName: profile.full_name || updated_by,
            })
          }
        }

        // 1-2. 관심 등록한 사용자들에게도 알림 (본인 제외, JD 담당자 제외)
        if (jd?.id && profile) {
          const { data: interests } = await supabaseAdmin
            .from('jd_interests')
            .select('user_id, profiles(id, full_name, email)')
            .eq('jd_id', jd.id)

          if (interests && interests.length > 0) {
            for (const interest of interests) {
              const interestProfile = Array.isArray(interest.profiles) ? interest.profiles[0] : interest.profiles
              // 본인이거나 JD 담당자는 제외
              if (interestProfile && interestProfile.id !== profile.id && interestProfile.email !== jd.created_by) {
                await createNotification({
                  userId: interestProfile.id,
                  type: 'pipeline_stage',
                  title: `관심 JD 파이프라인 변경: ${candidate?.name || '후보자'}`,
                  message: `${jd.position} 포지션의 "${candidate?.name || '후보자'}" 단계가 "${oldPipeline.stage}" → "${stage}"로 변경되었습니다.`,
                  relatedId: id,
                  relatedType: 'pipeline',
                  actionUrl: `/pipeline`,
                  senderId: profile.id,
                  senderName: profile.full_name || updated_by,
                })
              }
            }
          }
        }

        // 2. 후보자 등록자(Searcher)에게 알림 - 자신의 후보자인 경우만
        if (oldPipeline.candidate_created_by && profile) {
          const { data: candidateOwner } = await supabaseAdmin
            .from('profiles')
            .select('id, role')
            .eq('email', oldPipeline.candidate_created_by)
            .single()

          // Searcher가 자신의 후보자이고, 본인이 변경한 것이 아니면 알림
          if (candidateOwner && candidateOwner.id !== profile.id && candidateOwner.role === 'searcher') {
            await createNotification({
              userId: candidateOwner.id,
              type: 'pipeline_stage',
              title: `후보자 진행 단계 변경: ${candidate?.name || '후보자'}`,
              message: `"${candidate?.name || '후보자'}" 후보자의 단계가 "${oldPipeline.stage}" → "${stage}"로 변경되었습니다.`,
              relatedId: id,
              relatedType: 'pipeline',
              actionUrl: `/pipeline`,
              senderId: profile.id,
              senderName: profile.full_name || updated_by,
            })
          }
        }
      }
    }

    // last_activity_at 자동 업데이트
    body.last_activity_at = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('pipeline')
      .update(body)
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/pipeline/[id] PATCH]', e)
    return NextResponse.json({ error: '업데이트 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { error } = await supabaseAdmin
      .from('pipeline')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/pipeline/[id] DELETE]', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

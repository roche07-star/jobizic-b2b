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

        // JD 담당자에게 알림
        if (jd?.created_by) {
          const { data: jdOwner } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', jd.created_by)
            .single()

          if (jdOwner && jdOwner.id !== profile?.id) {
            await createNotification({
              userId: jdOwner.id,
              type: 'pipeline_stage',
              title: `파이프라인 단계 변경: ${candidate?.name || '후보자'}`,
              message: `${jd.position} 포지션의 "${candidate?.name || '후보자'}" 단계가 "${oldPipeline.stage}" → "${stage}"로 변경되었습니다.`,
              relatedId: id,
              relatedType: 'pipeline',
              actionUrl: `/pipeline`,
              senderId: profile?.id,
              senderName: profile?.full_name || updated_by,
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

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createNotification } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organization_id')
    const role = req.nextUrl.searchParams.get('role')
    const userEmail = req.nextUrl.searchParams.get('user_email')
    const jdId = req.nextUrl.searchParams.get('jd_id')
    const candidateId = req.nextUrl.searchParams.get('candidate_id')
    const stage = req.nextUrl.searchParams.get('stage')

    let q = supabaseAdmin
      .from('pipeline')
      .select(`
        *,
        job_descriptions (id, company, position, priority, created_by),
        candidates (id, name, email, current_company, current_position, status)
      `)
      .order('created_at', { ascending: false })

    // PM/Owner는 본인 JD에 연결된 파이프라인 조회, Searcher는 본인이 생성한 파이프라인만
    console.log('[pipeline] User:', userEmail, 'Role:', role)
    if (role !== 'admin' && userEmail) {
      if (role === 'searcher') {
        // Searcher: 본인이 생성한 파이프라인만
        console.log('[pipeline] Searcher: Filtering by created_by:', userEmail)
        q = q.eq('created_by', userEmail)
      } else if (role === 'headhunter' || role === 'owner') {
        // PM/Owner: 본인 JD에 연결된 모든 파이프라인
        console.log('[pipeline] PM/Owner: Filtering by JD owner:', userEmail)
        // 먼저 본인 JD 목록 조회
        const { data: myJDs } = await supabaseAdmin
          .from('job_descriptions')
          .select('id')
          .eq('created_by', userEmail)

        if (myJDs && myJDs.length > 0) {
          q = q.in('jd_id', myJDs.map(jd => jd.id))
        } else {
          // 본인 JD가 없으면 빈 배열 반환
          return NextResponse.json({ pipeline: [] })
        }
      }
    }

    // organization_id가 있으면 필터링 (admin이 특정 조직 선택 시)
    if (organizationId) {
      q = q.eq('organization_id', organizationId)
    }

    if (jdId) q = q.eq('jd_id', jdId)
    if (candidateId) q = q.eq('candidate_id', candidateId)
    if (stage) q = q.eq('stage', stage)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ pipeline: data ?? [] })
  } catch (e) {
    console.error('[api/pipeline GET]', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await supabaseAdmin
      .from('pipeline')
      .insert(body)
      .select(`
        id,
        job_descriptions (id, position, company, created_by),
        candidates (id, name)
      `)
      .single()
    if (error) {
      // 중복 체크
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 파이프라인에 추가된 조합입니다.' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 후보자-JD 매칭 알림
    const jd = data.job_descriptions as any
    const candidate = data.candidates as any

    if (body.created_by) {
      const { data: creator } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role')
        .eq('email', body.created_by)
        .single()

      if (!creator) {
        console.log('[pipeline POST] Creator not found:', body.created_by)
        return NextResponse.json({ id: data.id })
      }

      // 1. JD 담당자(PM)에게 알림 - 본인이 만든 JD 또는 관심 JD인 경우만
      if (jd?.created_by && jd.created_by !== body.created_by) {
        const { data: jdOwner } = await supabaseAdmin
          .from('profiles')
          .select('id, role')
          .eq('email', jd.created_by)
          .single()

        // PM/Owner가 자신의 JD에 매칭된 경우만 알림
        if (jdOwner && (jdOwner.role === 'headhunter' || jdOwner.role === 'owner')) {
          await createNotification({
            userId: jdOwner.id,
            type: 'assignment',
            title: '새 후보자 매칭',
            message: `${jd.company || '회사'} - ${jd.position} 포지션에 "${candidate?.name || '후보자'}" 후보자가 매칭되었습니다.`,
            relatedId: data.id,
            relatedType: 'pipeline',
            actionUrl: `/pipeline`,
            senderId: creator.id,
            senderName: creator.full_name || body.created_by,
          })
        }
      }

      // 1-2. 관심 등록한 사용자들에게도 알림 (본인 JD 제외)
      if (jd?.id) {
        const { data: interests } = await supabaseAdmin
          .from('jd_interests')
          .select('user_id, profiles(id, full_name, email)')
          .eq('jd_id', jd.id)

        if (interests && interests.length > 0) {
          for (const interest of interests) {
            const profile = Array.isArray(interest.profiles) ? interest.profiles[0] : interest.profiles
            // 본인이거나 이미 위에서 알림 받은 JD 담당자는 제외
            if (profile && profile.id !== creator.id && profile.email !== jd.created_by) {
              await createNotification({
                userId: profile.id,
                type: 'assignment',
                title: '관심 JD 새 후보자 매칭',
                message: `${jd.company || '회사'} - ${jd.position} 포지션에 "${candidate?.name || '후보자'}" 후보자가 매칭되었습니다.`,
                relatedId: data.id,
                relatedType: 'pipeline',
                actionUrl: `/pipeline`,
                senderId: creator.id,
                senderName: creator.full_name || body.created_by,
              })
            }
          }
        }
      }

      // 2. 후보자 등록자(Searcher)에게 알림 - 본인이 등록한 후보자인 경우만
      if (candidate && body.candidate_created_by && body.candidate_created_by !== body.created_by) {
        const { data: candidateOwner } = await supabaseAdmin
          .from('profiles')
          .select('id, role')
          .eq('email', body.candidate_created_by)
          .single()

        // Searcher가 자신의 후보자가 매칭된 경우만 알림
        if (candidateOwner && candidateOwner.role === 'searcher') {
          await createNotification({
            userId: candidateOwner.id,
            type: 'assignment',
            title: '후보자 매칭 완료',
            message: `"${candidate.name || '후보자'}" 후보자가 ${jd?.company || '회사'} - ${jd?.position || '포지션'}에 매칭되었습니다.`,
            relatedId: data.id,
            relatedType: 'pipeline',
            actionUrl: `/pipeline`,
            senderId: creator.id,
            senderName: creator.full_name || body.created_by,
          })
        }
      }
    }

    return NextResponse.json({ id: data.id })
  } catch (e) {
    console.error('[api/pipeline POST]', e)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

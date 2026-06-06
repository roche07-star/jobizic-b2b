import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyOrganizationMembers } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  try {
    // 쿼리 파라미터에서 organization_id 받기 (클라이언트에서 전달)
    const organizationId = req.nextUrl.searchParams.get('organization_id')
    const role = req.nextUrl.searchParams.get('role')
    const userEmail = req.nextUrl.searchParams.get('user_email')
    const status = req.nextUrl.searchParams.get('status')

    let q = supabaseAdmin
      .from('job_descriptions')
      .select(`
        *,
        created_by_user:profiles!fk_jd_created_by_profile(id, full_name, email)
      `)
      .order('created_at', { ascending: false })

    // Role 기반 필터링
    console.log('[jd] User:', userEmail, 'Role:', role)

    // organization_id 필터링
    if (organizationId) {
      q = q.eq('organization_id', organizationId)
    }

    // Admin과 Owner는 모든 JD 조회
    // headhunter는 본인 JD + 관심 JD + 활성 JD
    // 기타 사용자는 본인 JD 또는 활성 JD
    if (role && role !== 'admin' && role !== 'owner' && userEmail) {
      if (role === 'headhunter') {
        // headhunter: 관심 등록한 JD도 포함
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', userEmail)
          .single()

        if (profile) {
          const { data: interests } = await supabaseAdmin
            .from('jd_interests')
            .select('jd_id')
            .eq('user_id', profile.id)

          const interestedJdIds = interests?.map(i => i.jd_id) ?? []

          if (interestedJdIds.length > 0) {
            // 본인 JD OR 관심 JD OR 활성 JD
            q = q.or(`created_by.eq.${userEmail},id.in.(${interestedJdIds.join(',')}),status.eq.활성`)
          } else {
            // 관심 JD 없으면 본인 JD OR 활성 JD
            q = q.or(`created_by.eq.${userEmail},status.eq.활성`)
          }
        }
      } else {
        // 기타 role: 본인 JD OR 활성 JD
        q = q.or(`created_by.eq.${userEmail},status.eq.활성`)
      }
    }

    if (status) {
      q = q.eq('status', status)
    }

    const { data, error } = await q

    if (error) {
      console.error('[jd] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[jd] Found:', data?.length, 'JDs')
    if (data && data.length > 0) {
      console.log('[jd] Sample created_by values:', data.slice(0, 3).map(j => j.created_by))
    }

    return NextResponse.json({ jds: data ?? [] })
  } catch (e: any) {
    console.error('[api/jd GET]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { created_by } = body

    // 권한 체크: PM/owner만 JD 등록 가능
    if (created_by) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('email', created_by)
        .single()

      if (profile && profile.role === 'searcher') {
        return NextResponse.json(
          { error: 'Searcher는 JD를 등록할 수 없습니다. PM 또는 Owner에게 문의하세요.' },
          { status: 403 }
        )
      }

      if (profile && profile.role.startsWith('client_')) {
        return NextResponse.json(
          { error: '채용사 계정은 JD를 직접 등록할 수 없습니다.' },
          { status: 403 }
        )
      }
    }

    const { data, error } = await supabaseAdmin
      .from('job_descriptions')
      .insert(body)
      .select('id, position, company, organization_id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    console.log('[JD POST] Created JD:', { id: data.id, org_id: data.organization_id, created_by })

    // 새 JD 등록 알림 - 조직 멤버들에게 (본인 제외)
    if (data.organization_id && created_by) {
      console.log('[JD POST] Sending notifications to organization:', data.organization_id)
      const { data: creator } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .eq('email', created_by)
        .single()

      if (creator) {
        console.log('[JD POST] Creator found:', { id: creator.id, name: creator.full_name })
        const notifications = await notifyOrganizationMembers(
          data.organization_id,
          {
            type: 'new_jd',
            title: '새 JD 등록',
            message: `${data.company || '회사'} - ${data.position} 포지션이 등록되었습니다.`,
            relatedId: data.id,
            relatedType: 'jd',
            actionUrl: '/jd',
            senderId: creator.id,
            senderName: creator.full_name || created_by,
          },
          creator.id // 본인 제외
        )
        console.log('[JD POST] Notifications sent:', notifications.length)
      } else {
        console.log('[JD POST] Creator not found for email:', created_by)
      }
    } else {
      console.log('[JD POST] Skipping notifications - missing org_id or created_by')
    }

    return NextResponse.json({ id: data.id })
  } catch (e) {
    console.error('[api/jd POST]', e)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

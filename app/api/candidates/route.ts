import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyMembersByRole } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organization_id')
    const role = req.nextUrl.searchParams.get('role')
    const userEmail = req.nextUrl.searchParams.get('user_email')
    const status = req.nextUrl.searchParams.get('status')
    const search = req.nextUrl.searchParams.get('search')

    let q = supabaseAdmin
      .from('candidates')
      .select(`
        *,
        organization:organizations(id, name),
        created_by_user:profiles!fk_candidates_created_by_profile(id, full_name, email),
        pipeline:pipeline!pipeline_candidate_id_fkey(
          id,
          stage,
          is_active,
          job_descriptions(company, position)
        )
      `)
      .order('created_at', { ascending: false })

    // 본인이 등록한 후보자만 조회 (admin 제외)
    console.log('[candidates] User:', userEmail, 'Role:', role)
    if (role !== 'admin' && userEmail) {
      console.log('[candidates] Filtering by created_by:', userEmail)
      q = q.eq('created_by', userEmail)
    }

    // organization_id가 있으면 필터링 (admin이 특정 조직 선택 시)
    if (organizationId) {
      q = q.eq('organization_id', organizationId)
    }

    if (status) q = q.eq('status', status)
    if (search) {
      q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,current_company.ilike.%${search}%,current_position.ilike.%${search}%`)
    }

    const { data, error } = await q
    if (error) {
      console.error('[candidates] Query error:', error)
      console.error('[candidates] Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      }, { status: 500 })
    }
    console.log('[candidates] Found:', data?.length, 'candidates for user:', userEmail)
    if (data && data.length > 0) {
      console.log('[candidates] Sample created_by values:', data.slice(0, 3).map(c => c.created_by))
    }
    return NextResponse.json({ candidates: data ?? [] })
  } catch (e) {
    console.error('[api/candidates GET]', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await supabaseAdmin
      .from('candidates')
      .insert(body)
      .select('id, name, current_position, organization_id, created_by')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 새 후보자 등록 알림 - owner/PM에게 (본인 제외)
    if (data.organization_id && data.created_by) {
      const { data: creator } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .eq('email', data.created_by)
        .single()

      if (creator) {
        await notifyMembersByRole(
          data.organization_id,
          ['owner', 'headhunter'], // owner와 PM에게만 알림
          {
            type: 'new_candidate',
            title: '새 후보자 등록',
            message: `${data.name} (${data.current_position || '포지션 미상'}) 후보자가 등록되었습니다.`,
            relatedId: data.id,
            relatedType: 'candidate',
            actionUrl: '/candidates',
            senderId: creator.id,
            senderName: creator.full_name || data.created_by,
          }
        )
      }
    }

    return NextResponse.json({ id: data.id })
  } catch (e) {
    console.error('[api/candidates POST]', e)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

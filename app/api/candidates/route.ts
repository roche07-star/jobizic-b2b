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
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0')

    // ⚠️ CRITICAL: 아래 분석 필드들은 화면 표시에 필수입니다. 절대 삭제하지 마세요!
    // - career_summary, strength_summary, weakness_summary, career_trajectory
    // - skills, tech_stack, education, ideal_roles, key_highlights
    // - phone, birth_year, location, market_value, tags
    let q = supabaseAdmin
      .from('candidates')
      .select(`
        id,
        name,
        email,
        phone,
        birth_year,
        location,
        current_company,
        current_position,
        total_experience_years,
        career_summary,
        education,
        skills,
        tech_stack,
        ideal_roles,
        market_value,
        strength_summary,
        weakness_summary,
        career_trajectory,
        key_highlights,
        tags,
        status,
        job_search_status,
        created_at,
        created_by,
        organization_id,
        organization:organizations(id, name),
        created_by_user:profiles!fk_candidates_created_by_profile(id, full_name, email),
        pipeline:pipeline!pipeline_candidate_id_fkey(
          id,
          stage,
          is_active,
          job_descriptions(company, position)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Role별 필터링
    console.log('[candidates] User:', userEmail, 'Role:', role)

    // organization_id 필터링
    if (organizationId && role === 'admin') {
      // Admin만 organization_id 파라미터로 조직 선택 가능
      q = q.eq('organization_id', organizationId)
    } else if (role === 'owner' && userEmail) {
      // Owner는 자신의 조직 전체 후보자 조회
      const { data: ownerProfile } = await supabaseAdmin
        .from('profiles')
        .select('organization_id')
        .eq('email', userEmail)
        .single()

      if (ownerProfile?.organization_id) {
        console.log('[candidates] Owner: Filtering by organization_id:', ownerProfile.organization_id)
        q = q.eq('organization_id', ownerProfile.organization_id)
      } else {
        console.warn('[candidates] Owner has no organization_id')
      }
    }

    // Admin과 Owner는 조직 전체 후보자 조회
    // 기타 사용자는 본인이 등록한 후보자만 조회 (현재 조직 내에서만)
    if (role && role !== 'admin' && role !== 'owner' && userEmail) {
      // 먼저 현재 사용자의 organization_id 조회 (조직 격리를 위해 필수!)
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('organization_id')
        .eq('email', userEmail)
        .single()

      if (!userProfile?.organization_id) {
        console.warn('[candidates] User has no organization_id:', userEmail)
        return NextResponse.json({ candidates: [] }, { status: 200 })
      }

      // 조직 격리: 현재 조직의 후보자만 조회
      console.log('[candidates] Filtering by organization_id:', userProfile.organization_id, 'and created_by:', userEmail)
      q = q.eq('organization_id', userProfile.organization_id)
      q = q.eq('created_by', userEmail)
    }

    if (status) q = q.eq('status', status)
    if (search) {
      q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,current_company.ilike.%${search}%,current_position.ilike.%${search}%`)
    }

    const { data, error, count } = await q
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
    return NextResponse.json({
      candidates: data ?? [],
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
      offset,
      limit
    })
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

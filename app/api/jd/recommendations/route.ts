import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getServerProfile } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  try {
    const profile = await getServerProfile()
    if (!profile) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get('status') // pending, recommended, accepted, rejected
    const forMe = searchParams.get('for_me') === 'true' // 내가 받은 추천만
    const role = profile.role

    let query = supabaseAdmin
      .from('jd_recommendations')
      .select(`
        *,
        job_descriptions!inner(id, company, position, created_by),
        candidates!inner(
          id, name, email, current_position, total_experience_years,
          education, career_summary, desired_salary, metadata
        )
      `)
      .order('match_score', { ascending: false })

    // "내가 받은 추천" 모드
    if (forMe) {
      query = query
        .eq('recommended_to', profile.email)
        .in('status', ['recommended', 'accepted', 'rejected']) // pending 제외
    }
    // 역할별 필터링
    else if (role === 'admin') {
      // Super Admin: 모든 조직의 추천 조회 가능
      if (status) {
        query = query.eq('status', status)
      }
    } else if (role === 'owner') {
      // Owner: 본인 조직의 추천만
      query = query.eq('organization_id', profile.organization_id)
      if (status) {
        query = query.eq('status', status)
      }
    } else {
      // PM: 본인에게 추천된 것만 조회
      query = query.eq('recommended_to', profile.email)
      if (status) {
        query = query.eq('status', status)
      } else {
        // 기본: recommended 상태만
        query = query.eq('status', 'recommended')
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('[recommendations GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ recommendations: data || [] })

  } catch (error: any) {
    console.error('[recommendations GET] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

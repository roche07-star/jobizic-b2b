import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProfile } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const profile = await getProfile()
    if (!profile) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get('status') // pending, recommended, accepted, rejected
    const role = profile.role

    let query = supabaseAdmin
      .from('jd_recommendations')
      .select(`
        *,
        job_descriptions!inner(id, company, position, created_by),
        candidates!inner(id, name, email, current_position, total_experience_years)
      `)
      .eq('organization_id', profile.organization_id)
      .order('match_score', { ascending: false })

    // 역할별 필터링
    if (role === 'owner' || role === 'admin') {
      // 관리자: 모든 추천 조회 가능
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

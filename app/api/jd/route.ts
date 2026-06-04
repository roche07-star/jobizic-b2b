import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    // 쿼리 파라미터에서 organization_id 받기 (클라이언트에서 전달)
    const organizationId = req.nextUrl.searchParams.get('organization_id')
    const role = req.nextUrl.searchParams.get('role')
    const status = req.nextUrl.searchParams.get('status')

    let q = supabaseAdmin
      .from('job_descriptions')
      .select(`
        *,
        created_by_user:users(id, full_name, email)
      `)
      .order('created_at', { ascending: false })

    // organization_id가 있으면 필터링 (admin도 특정 조직 선택 시 필터링)
    if (organizationId) {
      q = q.eq('organization_id', organizationId)
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
    const { data, error } = await supabaseAdmin
      .from('job_descriptions')
      .insert(body)
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  } catch (e) {
    console.error('[api/jd POST]', e)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
        pipeline:pipeline!pipeline_candidate_id_fkey(
          id,
          stage,
          is_active,
          job_descriptions(company, position)
        )
      `)
      .order('created_at', { ascending: false })

    // 본인이 등록한 후보자만 조회 (admin 제외)
    if (role !== 'admin' && userEmail) {
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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  } catch (e) {
    console.error('[api/candidates POST]', e)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

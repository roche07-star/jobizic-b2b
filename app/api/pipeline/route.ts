import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organization_id')
    const role = req.nextUrl.searchParams.get('role')
    const jdId = req.nextUrl.searchParams.get('jd_id')
    const candidateId = req.nextUrl.searchParams.get('candidate_id')
    const stage = req.nextUrl.searchParams.get('stage')

    let q = supabaseAdmin
      .from('pipeline')
      .select(`
        *,
        job_descriptions (id, company, position, priority),
        candidates (id, name, email, current_company, current_position, status)
      `)
      .order('created_at', { ascending: false })

    // organization_id가 있으면 필터링 (admin도 특정 조직 선택 시 필터링)
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
      .select('id')
      .single()
    if (error) {
      // 중복 체크
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 파이프라인에 추가된 조합입니다.' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ id: data.id })
  } catch (e) {
    console.error('[api/pipeline POST]', e)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status')
    const search = req.nextUrl.searchParams.get('search')

    let q = supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false })

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
    const { data, error } = await supabase
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

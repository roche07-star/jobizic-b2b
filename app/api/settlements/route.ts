import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getSession, getProfile } from '@/lib/auth'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const profile = await getProfile()
    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Organization이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear()

    // RLS로 organization 격리됨
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('headhunter_email', profile.email)
      .eq('organization_id', profile.organization_id)
      .eq('year', year)
      .order('start_date', { ascending: true }) // 1월부터 순서대로 (오름차순)

    if (error) {
      console.error('[settlements GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settlements: data, year })
  } catch (e) {
    console.error('[settlements GET] Exception:', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const profile = await getProfile()
    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Organization이 없습니다.' }, { status: 403 })
    }

    const body = await req.json()
    const {
      candidate_name,
      candidate_email,
      start_date,
      salary,
      commission_rate = 17,
      incentive_rate = 70,
      company,
      position,
      memo,
      personal_override = 0,
      my_role = 'PM',
      partner_name,
      my_ratio = 50,
    } = body

    if (!candidate_name || !start_date || salary === undefined) {
      return NextResponse.json(
        { error: '후보자 이름, 입사일, 급여는 필수입니다.' },
        { status: 400 }
      )
    }

    if (typeof salary !== 'number' || salary < 0) {
      return NextResponse.json({ error: '급여는 0 이상이어야 합니다.' }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
      return NextResponse.json(
        { error: '입사일은 YYYY-MM-DD 형식이어야 합니다.' },
        { status: 400 }
      )
    }

    const { data, error} = await supabase
      .from('settlements')
      .insert({
        candidate_name,
        candidate_email,
        start_date,
        salary,
        commission_rate,
        incentive_rate,
        company,
        position,
        memo,
        personal_override,
        my_role,
        partner_name,
        my_ratio,
        headhunter_email: profile.email,
        organization_id: profile.organization_id, // Organization 격리
      })
      .select()
      .single()

    if (error) {
      console.error('[settlements POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settlement: data }, { status: 201 })
  } catch (e) {
    console.error('[settlements POST] Exception:', e)
    return NextResponse.json({ error: '등록 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

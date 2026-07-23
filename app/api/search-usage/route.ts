import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const DAILY_LIMIT = 3

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('user_id')
    const userType = req.nextUrl.searchParams.get('user_type')

    console.log('[search-usage GET] userId:', userId, 'userType:', userType)

    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    // user_type 또는 role 확인 (profiles 테이블에서)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_type, role')
      .eq('id', userId)
      .single()

    console.log('[search-usage GET] profile:', profile)

    // super admin은 무제한
    if (profile?.user_type === 'SUPER_ADMIN' || userType === 'SUPER_ADMIN') {
      return NextResponse.json({
        remaining: 999,
        total: 999,
        unlimited: true
      })
    }

    const today = new Date().toISOString().split('T')[0]

    // 오늘 사용 횟수 조회
    const { data } = await supabaseAdmin
      .from('search_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('date', today)
      .single()

    const count = data?.count || 0

    return NextResponse.json({
      remaining: Math.max(0, DAILY_LIMIT - count),
      total: DAILY_LIMIT,
      used: count,
      unlimited: false
    })
  } catch (e) {
    console.error('[api/search-usage GET]', e)
    return NextResponse.json({ error: '조회 실패' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user_id, user_type } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    // user_type 또는 role 확인 (profiles 테이블에서)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_type, role')
      .eq('id', user_id)
      .single()

    console.log('[search-usage POST] profile:', profile)

    // super admin은 무제한
    if (profile?.user_type === 'SUPER_ADMIN' || user_type === 'SUPER_ADMIN') {
      return NextResponse.json({
        success: true,
        remaining: 999,
        unlimited: true
      })
    }

    const today = new Date().toISOString().split('T')[0]

    // 오늘 사용 횟수 조회
    const { data: existing } = await supabaseAdmin
      .from('search_usage')
      .select('count')
      .eq('user_id', user_id)
      .eq('date', today)
      .single()

    const count = existing?.count || 0

    // 제한 초과 체크
    if (count >= DAILY_LIMIT) {
      return NextResponse.json({
        error: `하루 사용 가능 횟수(${DAILY_LIMIT}회)를 초과했습니다.`,
        remaining: 0
      }, { status: 429 })
    }

    // 카운트 증가 (upsert)
    const newCount = count + 1
    await supabaseAdmin
      .from('search_usage')
      .upsert({
        user_id,
        date: today,
        count: newCount
      }, {
        onConflict: 'user_id,date'
      })

    return NextResponse.json({
      success: true,
      remaining: DAILY_LIMIT - newCount,
      used: newCount
    })
  } catch (e) {
    console.error('[api/search-usage POST]', e)
    return NextResponse.json({ error: '사용 횟수 증가 실패' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET - 목표 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userEmail = searchParams.get('user_email')

    if (!userEmail) {
      return NextResponse.json({ error: '필수 파라미터가 없습니다.' }, { status: 400 })
    }

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('goals')
      .eq('email', userEmail)
      .single()

    if (profileError) {
      console.error('Failed to fetch goals:', profileError)
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
    }

    // goals가 없으면 기본값 반환
    const goals = profileData?.goals || {
      hiredTarget: 10,
      passedTarget: 20,
      proposalTarget: 10,
      settlements: {} // 연도별 정산 목표
    }

    return NextResponse.json({ goals })
  } catch (error) {
    console.error('GET /api/goals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - 목표 저장
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userEmail = searchParams.get('user_email')

    if (!userEmail) {
      return NextResponse.json({ error: '필수 파라미터가 없습니다.' }, { status: 400 })
    }

    const body = await req.json()
    const { hiredTarget, passedTarget, proposalTarget, settlements } = body

    // 기존 데이터 조회
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('goals')
      .eq('email', userEmail)
      .single()

    const currentGoals = profileData?.goals || {}

    // 새 목표 객체 생성
    const goals = {
      ...currentGoals,
      ...(hiredTarget !== undefined && { hiredTarget }),
      ...(passedTarget !== undefined && { passedTarget }),
      ...(proposalTarget !== undefined && { proposalTarget }),
      ...(settlements !== undefined && { settlements })
    }

    // 유효성 검사 (선택적 필드)
    if (
      (hiredTarget !== undefined && (typeof hiredTarget !== 'number' || hiredTarget < 0)) ||
      (passedTarget !== undefined && (typeof passedTarget !== 'number' || passedTarget < 0)) ||
      (proposalTarget !== undefined && (typeof proposalTarget !== 'number' || proposalTarget < 0))
    ) {
      return NextResponse.json({ error: 'Invalid goals data' }, { status: 400 })
    }

    // Supabase에 저장
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ goals })
      .eq('email', userEmail)

    if (updateError) {
      console.error('Failed to save goals:', updateError)
      return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
    }

    return NextResponse.json({ success: true, goals })
  } catch (error) {
    console.error('POST /api/goals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

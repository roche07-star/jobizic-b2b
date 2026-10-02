import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/auth/register
 * 공개 회원가입 API (로그인 불필요)
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, phone } = await req.json()

    // 입력 검증
    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: '이메일, 비밀번호, 이름은 필수입니다.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '비밀번호는 최소 6자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    const supabase = await getSupabaseServer()

    // 1. Supabase Auth에 사용자 생성
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone,
        },
      },
    })

    if (authError) {
      console.error('[register] Auth error:', authError)
      return NextResponse.json(
        { error: authError.message || '회원가입 실패' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: '사용자 생성 실패' },
        { status: 500 }
      )
    }

    // 2. profiles 테이블에 사용자 정보 추가
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      email,
      full_name,
      role: 'headhunter', // 기본 role
      is_active: false, // 관리자 승인 대기
    })

    if (profileError) {
      console.error('[register] Profile error:', profileError)
      // Auth 사용자는 생성되었으므로, 에러는 로그만 남김
    }

    console.log('[register] Success:', {
      email,
      userId: authData.user.id,
    })

    return NextResponse.json({
      success: true,
      message: '회원가입 완료. 관리자 승인 후 이용 가능합니다.',
      user: {
        id: authData.user.id,
        email,
        full_name,
      },
    })
  } catch (e: any) {
    console.error('[register] Error:', e)
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    )
  }
}

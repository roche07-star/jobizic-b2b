import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { reportSecurityEvent, extractIpFromHeaders } from '@/lib/security-reporter'
import { runSecurityChecks } from '@/lib/security-checks'

// 일회용/봇 이메일 도메인 차단 목록
const BLOCKED_DOMAINS = [
  'example.com', 'example.org', 'example.net',
  'test.com', 'mailinator.com', 'guerrillamail.com',
  'tempmail.com', 'throwaway.email', 'yopmail.com',
  'sharklasers.com', 'guerrillamailblock.com',
]

// 봇 이름 패턴
const BOT_NAME_PATTERN = /^(probe|qa|tg|bot|test|spam|fake)\d*/i

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

    // 차단 도메인 / 봇 패턴 검사
    const emailDomain = email.split('@')[1]?.toLowerCase()
    const isBlockedDomain = BLOCKED_DOMAINS.includes(emailDomain)
    const isBotName = BOT_NAME_PATTERN.test(String(full_name).trim())

    if (isBlockedDomain || isBotName) {
      reportSecurityEvent({
        event_type: 'bot_detected',
        severity: 'MEDIUM',
        source_ip: extractIpFromHeaders(req.headers),
        request_path: '/api/auth/register',
        http_method: 'POST',
        status_code: 403,
        event_detail: { email, full_name, reason: isBlockedDomain ? 'blocked_domain' : 'bot_name_pattern' },
      })
      return NextResponse.json({ error: '회원가입이 허용되지 않는 이메일입니다.' }, { status: 403 })
    }

    // SQL 인젝션, XSS, 버퍼 오버플로우 감지
    const secCheck = runSecurityChecks(
      { email, full_name: String(full_name), phone: phone ? String(phone) : undefined },
      { email: 254, full_name: 100, phone: 20 },
      req,
      '/api/auth/register',
    )
    if (secCheck.blocked) {
      return NextResponse.json({ error: '입력값에 허용되지 않는 문자가 포함되어 있습니다.' }, { status: 400 })
    }

    if (String(full_name).trim().length < 2) {
      return NextResponse.json(
        { error: '이름은 2자 이상 입력해 주세요.' },
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

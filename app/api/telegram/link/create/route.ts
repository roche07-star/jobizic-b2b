import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateLinkCode, generateDeepLink } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  try {
    const profile = await getProfile()
    if (!profile) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 이미 연동된 경우 체크
    if (profile.telegram_chat_id) {
      return NextResponse.json({
        error: '이미 텔레그램이 연동되어 있습니다.',
        alreadyLinked: true
      }, { status: 400 })
    }

    // 기존 미사용 코드가 있는지 확인
    const { data: existingCode } = await supabaseAdmin
      .from('telegram_link_codes')
      .select('code, expires_at')
      .eq('user_email', profile.email)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingCode) {
      // 기존 코드 재사용
      const deepLink = generateDeepLink(existingCode.code)
      return NextResponse.json({
        code: existingCode.code,
        deepLink,
        expiresAt: existingCode.expires_at,
      })
    }

    // 새 코드 생성
    const code = generateLinkCode(6)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5분 후

    const { error } = await supabaseAdmin
      .from('telegram_link_codes')
      .insert({
        code,
        user_email: profile.email,
        expires_at: expiresAt.toISOString(),
      })

    if (error) {
      console.error('[Telegram] Create link code error:', error)
      return NextResponse.json({ error: '코드 생성에 실패했습니다.' }, { status: 500 })
    }

    const deepLink = generateDeepLink(code)

    return NextResponse.json({
      code,
      deepLink,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('[Telegram] Create link error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

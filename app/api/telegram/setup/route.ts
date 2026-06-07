import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { setWebhook, setMyCommands, getMe } from '@/lib/telegram'

/**
 * 텔레그램 봇 초기 설정
 * - Webhook 설정
 * - 명령어 등록
 * - 봇 정보 확인
 *
 * 관리자만 실행 가능
 */
export async function POST(req: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: '인증이 필요합니다.',
        details: 'Authorization 헤더가 없습니다.'
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Supabase 클라이언트로 토큰 검증
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    console.log('[Telegram Setup] User:', user?.email)

    if (userError || !user) {
      console.log('[Telegram Setup] Token verification failed:', userError)
      return NextResponse.json({
        error: '유효하지 않은 토큰입니다.',
        details: userError?.message
      }, { status: 401 })
    }

    // 프로필 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('[Telegram Setup] Profile:', profile)

    if (profileError || !profile) {
      console.log('[Telegram Setup] Profile error:', profileError)
      return NextResponse.json({
        error: '프로필을 찾을 수 없습니다.',
        details: profileError?.message
      }, { status: 404 })
    }

    if (profile.role !== 'admin') {
      console.log('[Telegram Setup] Auth failed - role:', profile.role)
      return NextResponse.json({
        error: '권한이 없습니다.',
        details: `현재 role: ${profile.role}. admin 권한이 필요합니다.`
      }, { status: 403 })
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.' }, { status: 500 })
    }

    const results: any = {
      botInfo: null,
      webhook: false,
      commands: false,
    }

    // 1. 봇 정보 확인
    const botInfo = await getMe()
    if (!botInfo) {
      return NextResponse.json({ error: '봇 정보를 가져올 수 없습니다. 토큰을 확인하세요.' }, { status: 500 })
    }
    results.botInfo = botInfo

    // 2. Webhook 설정
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://jobizic-biz.vercel.app'}/api/telegram/webhook`
    const secretToken = process.env.TELEGRAM_SECRET_TOKEN || crypto.randomUUID()

    const webhookSet = await setWebhook(webhookUrl, secretToken)
    results.webhook = webhookSet

    // 3. 명령어 등록
    const commandsSet = await setMyCommands()
    results.commands = commandsSet

    // 4. 환경 변수 가이드
    if (!process.env.TELEGRAM_SECRET_TOKEN) {
      results.warning = `TELEGRAM_SECRET_TOKEN이 설정되지 않았습니다. .env에 추가하세요: TELEGRAM_SECRET_TOKEN=${secretToken}`
    }

    return NextResponse.json({
      success: true,
      message: '텔레그램 봇 설정이 완료되었습니다!',
      ...results,
    })
  } catch (error) {
    console.error('[Telegram] Setup error:', error)
    return NextResponse.json({ error: '설정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * 현재 설정 상태 확인 (GET)
 */
export async function GET(req: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: '인증이 필요합니다.',
        details: 'Authorization 헤더가 없습니다.'
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Supabase 클라이언트로 토큰 검증
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({
        error: '유효하지 않은 토큰입니다.'
      }, { status: 401 })
    }

    // 프로필 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({
        configured: false,
        message: 'TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.'
      })
    }

    const botInfo = await getMe()

    return NextResponse.json({
      configured: !!botInfo,
      botInfo,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://jobizic-biz.vercel.app'}/api/telegram/webhook`,
      hasSecretToken: !!process.env.TELEGRAM_SECRET_TOKEN,
    })
  } catch (error) {
    console.error('[Telegram] Get status error:', error)
    return NextResponse.json({ error: '상태 확인 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

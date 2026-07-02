import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Adam으로부터 구직 요청 접수
export async function POST(request: NextRequest) {
  try {
    // API Key 검증
    const apiKey = request.headers.get('x-adam-api-key')
    const expectedApiKey = process.env.ADAM_TO_EVE_API_KEY

    if (!expectedApiKey) {
      console.error('⚠️ ADAM_TO_EVE_API_KEY 환경변수 미설정')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    if (apiKey !== expectedApiKey) {
      console.error('❌ API Key 불일치')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      adam_user_email,
      adam_user_name,
      adam_application_id,
      company,
      position,
      status,
      request_message
    } = body

    console.log('📥 구직 요청 접수 (Adam → Eve):', {
      adam_user_email,
      company,
      position
    })

    if (!adam_user_email || !adam_application_id || !company || !position) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // DB에 저장
    const { data: jobSeekerRequest, error: insertError } = await supabase
      .from('job_seeker_requests')
      .insert({
        adam_user_email,
        adam_user_name,
        adam_application_id,
        company,
        position,
        status,
        request_message,
        request_status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      console.error('DB 저장 실패:', insertError)
      throw new Error('Failed to save job seeker request')
    }

    console.log('✅ DB 저장 완료:', jobSeekerRequest.id)

    // Telegram 알림 전송 (TODO)
    try {
      await sendTelegramNotification(jobSeekerRequest)
    } catch (telegramError) {
      console.error('Telegram 알림 실패:', telegramError)
      // 알림 실패해도 요청은 저장됨
    }

    return NextResponse.json({
      success: true,
      id: jobSeekerRequest.id,
      message: 'Job seeker request received'
    })

  } catch (error: any) {
    console.error('구직 요청 처리 중 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Telegram 알림 전송
async function sendTelegramNotification(request: any) {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
  const telegramChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

  if (!telegramBotToken || !telegramChatId) {
    console.warn('⚠️ Telegram 설정 없음 - 알림 스킵')
    return
  }

  const message = `
🆘 *신규 구직 요청*

👤 *구직자*: ${request.adam_user_name || request.adam_user_email}
🏢 *회사*: ${request.company}
💼 *포지션*: ${request.position}
📋 *현재 상태*: ${request.status || '지원 완료'}

💬 *요청 메시지*:
${request.request_message || '(메시지 없음)'}

🔗 *할당하기*: [Eve 대시보드](https://jobizic-biz.vercel.app/admin)

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
  `.trim()

  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: 'Markdown'
      })
    })

    if (!res.ok) {
      const error = await res.json()
      console.error('Telegram API 오류:', error)
    } else {
      console.log('✅ Telegram 알림 전송 완료')
    }
  } catch (error) {
    console.error('Telegram 전송 중 오류:', error)
    throw error
  }
}

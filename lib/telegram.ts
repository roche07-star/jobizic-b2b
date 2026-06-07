// Telegram Bot Utility Functions
// Handles sending messages and managing bot interactions

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export interface TelegramMessage {
  chatId: number | string
  text: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disableWebPagePreview?: boolean
  replyMarkup?: {
    inline_keyboard?: Array<Array<{
      text: string
      url?: string
      callback_data?: string
    }>>
  }
}

/**
 * 텔레그램 메시지 전송
 */
export async function sendTelegramMessage(options: TelegramMessage): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[Telegram] TELEGRAM_BOT_TOKEN not configured')
    return false
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: options.chatId,
        text: options.text,
        parse_mode: options.parseMode || 'HTML',
        disable_web_page_preview: options.disableWebPagePreview ?? true,
        reply_markup: options.replyMarkup,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[Telegram] Send message failed:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[Telegram] Send message error:', error)
    return false
  }
}

/**
 * 사용자별로 메시지 전송 (email → telegram_chat_id 조회)
 */
export async function sendMessageToUser(
  userEmail: string,
  text: string,
  options?: Omit<TelegramMessage, 'chatId' | 'text'>
): Promise<boolean> {
  const { supabaseAdmin } = await import('./supabase-admin')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('telegram_chat_id')
    .eq('email', userEmail)
    .single()

  if (!profile?.telegram_chat_id) {
    console.log(`[Telegram] User ${userEmail} has no telegram_chat_id`)
    return false
  }

  return sendTelegramMessage({
    chatId: profile.telegram_chat_id,
    text,
    ...options,
  })
}

/**
 * 여러 사용자에게 메시지 전송
 */
export async function sendMessageToUsers(
  userEmails: string[],
  text: string,
  options?: Omit<TelegramMessage, 'chatId' | 'text'>
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    userEmails.map((email) => sendMessageToUser(email, text, options))
  )

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length
  const failed = results.length - sent

  return { sent, failed }
}

/**
 * Webhook 설정
 */
export async function setWebhook(webhookUrl: string, secretToken?: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured')
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ['message', 'callback_query'],
      }),
    })

    const result = await response.json()

    if (!result.ok) {
      console.error('[Telegram] setWebhook failed:', result)
      return false
    }

    console.log('[Telegram] Webhook set successfully:', webhookUrl)
    return true
  } catch (error) {
    console.error('[Telegram] setWebhook error:', error)
    return false
  }
}

/**
 * 봇 명령어 등록
 */
export async function setMyCommands(): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: '계정 연동 시작' },
          { command: 'today', description: '오늘 할 일 보기' },
          { command: 'pipeline', description: '채용 프로세스 현황' },
          { command: 'jd', description: '내 관심 JD 보기' },
          { command: 'help', description: '도움말' },
        ],
      }),
    })

    const result = await response.json()
    return result.ok
  } catch (error) {
    console.error('[Telegram] setMyCommands error:', error)
    return false
  }
}

/**
 * 봇 정보 조회
 */
export async function getMe(): Promise<any> {
  if (!TELEGRAM_BOT_TOKEN) return null

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getMe`)
    const result = await response.json()
    return result.ok ? result.result : null
  } catch (error) {
    console.error('[Telegram] getMe error:', error)
    return null
  }
}

/**
 * 연동 코드 생성
 */
export function generateLinkCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 혼동 문자 제외 (0,O,I,1)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Deep Link 생성
 */
export function generateDeepLink(code: string): string {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'jobizic_recruiter_bot'
  return `https://t.me/${botUsername}?start=${code}`
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTelegramMessage } from '@/lib/telegram'

const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN

export async function POST(req: NextRequest) {
  try {
    // Webhook 보안 검증
    const secretToken = req.headers.get('x-telegram-bot-api-secret-token')
    if (TELEGRAM_SECRET_TOKEN && secretToken !== TELEGRAM_SECRET_TOKEN) {
      console.error('[Telegram] Invalid secret token')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const update = await req.json()
    console.log('[Telegram] Received update:', JSON.stringify(update, null, 2))

    // 메시지 처리
    if (update.message) {
      await handleMessage(update.message)
    }

    // Callback query 처리 (인라인 버튼)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram] Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * 메시지 처리
 */
async function handleMessage(message: any) {
  const chatId = message.chat.id
  const text = message.text?.trim()
  const username = message.from?.username

  if (!text) return

  // /start 명령어 (계정 연동)
  if (text.startsWith('/start')) {
    const parts = text.split(' ')
    const code = parts[1]

    if (code) {
      // Deep Link로 들어온 경우 (코드 포함)
      await handleLinkWithCode(chatId, username, code)
    } else {
      // 일반 /start
      await sendTelegramMessage({
        chatId,
        text: `안녕하세요! Jobizic Recruiter Bot입니다. 🤖

계정 연동을 위해 웹에서 연동 코드를 발급받아주세요.

📱 <b>연동 방법:</b>
1. 웹앱에 로그인
2. "텔레그램 연동" 버튼 클릭
3. 자동으로 연결됩니다!`,
        parseMode: 'HTML',
      })
    }
    return
  }

  // 연동 코드 직접 입력 (6자리 코드)
  if (/^[A-Z0-9]{6}$/.test(text)) {
    await handleLinkWithCode(chatId, username, text)
    return
  }

  // /today 명령어
  if (text === '/today') {
    await handleTodayCommand(chatId)
    return
  }

  // /pipeline 명령어
  if (text === '/pipeline') {
    await handlePipelineCommand(chatId)
    return
  }

  // /help 명령어
  if (text === '/help') {
    await sendTelegramMessage({
      chatId,
      text: `📚 <b>사용 가능한 명령어:</b>

/today - 오늘 할 일 보기
/pipeline - 채용 프로세스 현황
/help - 도움말

궁금한 점이 있으시면 웹앱을 확인해주세요!`,
      parseMode: 'HTML',
    })
    return
  }

  // 알 수 없는 메시지
  await sendTelegramMessage({
    chatId,
    text: `죄송합니다. 이해하지 못했습니다. 😅

/help 명령어로 사용 가능한 기능을 확인해주세요.`,
  })
}

/**
 * 계정 연동 처리
 */
async function handleLinkWithCode(chatId: number, username: string | undefined, code: string) {
  // 1. 코드 확인
  const { data: linkCode } = await supabaseAdmin
    .from('telegram_link_codes')
    .select('user_email, expires_at, used_at')
    .eq('code', code)
    .single()

  if (!linkCode) {
    await sendTelegramMessage({
      chatId,
      text: '❌ 잘못된 연동 코드입니다.\n\n웹에서 새로운 코드를 발급받아주세요.',
    })
    return
  }

  if (linkCode.used_at) {
    await sendTelegramMessage({
      chatId,
      text: '❌ 이미 사용된 코드입니다.\n\n웹에서 새로운 코드를 발급받아주세요.',
    })
    return
  }

  if (new Date(linkCode.expires_at) < new Date()) {
    await sendTelegramMessage({
      chatId,
      text: '❌ 만료된 코드입니다. (유효시간: 5분)\n\n웹에서 새로운 코드를 발급받아주세요.',
    })
    return
  }

  // 2. 계정 연동
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      telegram_chat_id: chatId,
      telegram_username: username,
      telegram_verified_at: new Date().toISOString(),
    })
    .eq('email', linkCode.user_email)

  if (updateError) {
    console.error('[Telegram] Link account error:', updateError)
    await sendTelegramMessage({
      chatId,
      text: '❌ 연동 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.',
    })
    return
  }

  // 3. 코드 사용 처리
  await supabaseAdmin
    .from('telegram_link_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code)

  // 4. 사용자 정보 조회
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, role')
    .eq('email', linkCode.user_email)
    .single()

  // 5. 성공 메시지
  await sendTelegramMessage({
    chatId,
    text: `✅ <b>계정 연동 완료!</b>

👤 ${profile?.full_name || linkCode.user_email}
🏷️ ${getRoleKorean(profile?.role)}

이제 실시간 알림을 받을 수 있습니다! 🎉

/today - 오늘 할 일 보기
/pipeline - 채용 프로세스 현황`,
    parseMode: 'HTML',
  })
}

/**
 * /today 명령어 처리
 */
async function handleTodayCommand(chatId: number) {
  // 1. 사용자 확인
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name, role, organization_id')
    .eq('telegram_chat_id', chatId)
    .single()

  if (!profile) {
    await sendTelegramMessage({
      chatId,
      text: '❌ 연동되지 않은 계정입니다.\n\n/start 명령어로 계정을 연동해주세요.',
    })
    return
  }

  // 2. 오늘 할 일 조회 (간단 버전)
  const today = new Date().toISOString().split('T')[0]

  // 신규 JD
  const { data: newJDs } = await supabaseAdmin
    .from('job_descriptions')
    .select('id, company, position')
    .eq('organization_id', profile.organization_id)
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: false })
    .limit(5)

  // 진행 중인 파이프라인
  const { data: activePipelines } = await supabaseAdmin
    .from('pipeline')
    .select(`
      id,
      stage,
      job_descriptions(company, position),
      candidates(name)
    `)
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)
    .in('stage', ['서류검토', '1차면접', '2차면접', '최종면접'])
    .limit(10)

  // 메시지 구성
  let message = `📅 <b>오늘의 현황</b>\n\n`

  if (newJDs && newJDs.length > 0) {
    message += `🆕 <b>신규 JD (${newJDs.length}건)</b>\n`
    newJDs.forEach((jd) => {
      message += `  • ${jd.company} - ${jd.position}\n`
    })
    message += '\n'
  }

  if (activePipelines && activePipelines.length > 0) {
    message += `📊 <b>진행 중 (${activePipelines.length}건)</b>\n`
    activePipelines.slice(0, 5).forEach((p: any) => {
      message += `  • [${p.stage}] ${p.candidates?.name} - ${p.job_descriptions?.company}\n`
    })
    if (activePipelines.length > 5) {
      message += `  ... 외 ${activePipelines.length - 5}건\n`
    }
  } else {
    message += '현재 진행 중인 프로세스가 없습니다.\n'
  }

  message += '\n자세한 내용은 웹에서 확인하세요! 💻'

  await sendTelegramMessage({
    chatId,
    text: message,
    parseMode: 'HTML',
    replyMarkup: {
      inline_keyboard: [[
        { text: '🌐 웹에서 보기', url: 'https://jobizic-b2b.vercel.app' }
      ]]
    }
  })
}

/**
 * /pipeline 명령어 처리
 */
async function handlePipelineCommand(chatId: number) {
  // 사용자 확인
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, role, organization_id')
    .eq('telegram_chat_id', chatId)
    .single()

  if (!profile) {
    await sendTelegramMessage({
      chatId,
      text: '❌ 연동되지 않은 계정입니다.\n\n/start 명령어로 계정을 연동해주세요.',
    })
    return
  }

  // 단계별 현황 조회
  const stages = ['신규', '서류검토', '1차면접', '2차면접', '최종면접', '처우협의']
  const counts: Record<string, number> = {}

  for (const stage of stages) {
    const { count } = await supabaseAdmin
      .from('pipeline')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .eq('stage', stage)
      .eq('is_active', true)

    counts[stage] = count || 0
  }

  let message = `📊 <b>채용 프로세스 현황</b>\n\n`

  stages.forEach((stage) => {
    const emoji = getStageEmoji(stage)
    message += `${emoji} ${stage}: ${counts[stage]}건\n`
  })

  message += '\n자세한 내용은 웹에서 확인하세요!'

  await sendTelegramMessage({
    chatId,
    text: message,
    parseMode: 'HTML',
    replyMarkup: {
      inline_keyboard: [[
        { text: '🌐 웹에서 보기', url: 'https://jobizic-b2b.vercel.app/pipeline' }
      ]]
    }
  })
}

/**
 * Callback query 처리 (인라인 버튼 클릭)
 */
async function handleCallbackQuery(query: any) {
  const chatId = query.message.chat.id
  const data = query.data

  // 여기에 버튼 액션 처리 추가
  console.log('[Telegram] Callback query:', data)
}

/**
 * Role 한글 변환
 */
function getRoleKorean(role: string | undefined): string {
  const roleMap: Record<string, string> = {
    admin: '관리자',
    owner: 'Owner',
    headhunter: 'PM',
    searcher: 'Searcher',
  }
  return roleMap[role || ''] || role || '사용자'
}

/**
 * 단계별 이모지
 */
function getStageEmoji(stage: string): string {
  const emojiMap: Record<string, string> = {
    신규: '🆕',
    서류검토: '📄',
    '1차면접': '👤',
    '2차면접': '👥',
    최종면접: '🎯',
    처우협의: '💰',
    합격: '✅',
    불합격: '❌',
  }
  return emojiMap[stage] || '📌'
}

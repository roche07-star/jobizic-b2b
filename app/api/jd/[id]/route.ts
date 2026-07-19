import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTelegramMessage } from '@/lib/telegram'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { data, error } = await supabaseAdmin
      .from('job_descriptions')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[api/jd/[id] GET]', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { user_email, user_role, ...updateData } = body

    // 권한 체크: status 변경은 모두 가능, 그 외 수정은 본인/owner/admin만
    if (Object.keys(updateData).some(key => key !== 'status')) {
      if (user_email && user_role) {
        const { data: jd } = await supabaseAdmin
          .from('job_descriptions')
          .select('created_by')
          .eq('id', id)
          .single()

        if (jd && jd.created_by !== user_email && user_role !== 'owner' && user_role !== 'admin') {
          return NextResponse.json({ error: '본인이 작성한 JD만 수정할 수 있습니다.' }, { status: 403 })
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('job_descriptions')
      .update(updateData)
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 상태가 "활성"으로 변경된 경우 텔레그램 알림
    if (updateData.status === '활성') {
      console.log('[JD PATCH] Status changed to 활성, sending notifications...')

      const { data: jd } = await supabaseAdmin
        .from('job_descriptions')
        .select('id, company, position, organization_id, created_by')
        .eq('id', id)
        .single()

      if (jd?.organization_id) {
        // 조직 내 텔레그램 연동 유저 조회 (본인 포함)
        console.log('[JD PATCH] Looking for telegram members in org:', jd.organization_id)
        const { data: telegramMembers, error: telegramError } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, email, telegram_chat_id')
          .eq('organization_id', jd.organization_id)
          .not('telegram_chat_id', 'is', null)

        if (telegramError) {
          console.error('[JD PATCH] Telegram members query error:', telegramError)
        }

        console.log('[JD PATCH] Telegram members found:', telegramMembers?.length || 0)

        if (telegramMembers && telegramMembers.length > 0) {
          console.log('[JD PATCH] TELEGRAM_BOT_TOKEN configured:', !!process.env.TELEGRAM_BOT_TOKEN)

          const telegramMessage = `✅ <b>[JD 활성화]</b>

🏢 회사: ${jd.company || '회사명 미상'}
💼 포지션: ${jd.position}

지금 바로 확인하고 후보자를 추천하세요!`

          for (const member of telegramMembers) {
            try {
              console.log('[JD PATCH] Sending Telegram to:', member.email, 'chat_id:', member.telegram_chat_id)
              const success = await sendTelegramMessage({
                chatId: member.telegram_chat_id!,
                text: telegramMessage,
                parseMode: 'HTML',
                replyMarkup: {
                  inline_keyboard: [[
                    { text: '🌐 JD 보러가기', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://jobizic-biz.vercel.app'}/jd` }
                  ]]
                }
              })
              console.log('[JD PATCH] Telegram result for', member.email, ':', success ? '✅ SUCCESS' : '❌ FAILED')
            } catch (err) {
              console.error('[JD PATCH] Telegram send failed for', member.email, err)
            }
          }
        } else {
          console.log('[JD PATCH] No Telegram members found')
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/jd/[id] PATCH]', e)
    return NextResponse.json({ error: '업데이트 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const url = new URL(req.url)
    const userEmail = url.searchParams.get('user_email')
    const userRole = url.searchParams.get('user_role')

    // 권한 체크: 본인/owner/admin만 삭제 가능
    if (userEmail && userRole) {
      const { data: jd } = await supabaseAdmin
        .from('job_descriptions')
        .select('created_by')
        .eq('id', id)
        .single()

      if (jd && jd.created_by !== userEmail && userRole !== 'owner' && userRole !== 'admin') {
        return NextResponse.json({ error: '본인이 작성한 JD만 삭제할 수 있습니다.' }, { status: 403 })
      }
    }

    const { error } = await supabaseAdmin
      .from('job_descriptions')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/jd/[id] DELETE]', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

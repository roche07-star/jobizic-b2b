import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getServerProfile } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const profile = await getServerProfile()

    if (!profile) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 권한 체크: super admin만
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { admin_comment, current_salary, desired_salary, education, career_summary } = await req.json()

    console.log('[recommendation send] ID:', id, 'by:', profile.email)

    // 추천 정보 조회 (Super Admin은 모든 조직 접근 가능)
    const { data: recommendation, error: fetchError } = await supabaseAdmin
      .from('jd_recommendations')
      .select(`
        *,
        job_descriptions!inner(company, position),
        candidates!inner(id, name, current_position)
      `)
      .eq('id', id)
      .single()

    if (fetchError || !recommendation) {
      console.error('[recommendation send] Fetch error:', fetchError)
      return NextResponse.json({ error: '추천을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 후보자 정보 업데이트 (연봉, 학력, 경력)
    if (current_salary || desired_salary || education || career_summary) {
      try {
        const candidateId = (recommendation as any).candidates.id
        console.log('[recommendation send] Updating candidate:', candidateId)
        const updateData: any = {}

        if (desired_salary) {
          updateData.desired_salary = desired_salary
          console.log('[recommendation send] desired_salary:', desired_salary)
        }

        if (education && typeof education === 'string' && education.trim()) {
          // 쉼표로 구분된 문자열을 배열로 변환
          updateData.education = education.split(',').map((e: string) => e.trim()).filter(Boolean)
          console.log('[recommendation send] education:', updateData.education)
        }

        if (career_summary && typeof career_summary === 'string') {
          updateData.career_summary = career_summary
          console.log('[recommendation send] career_summary length:', career_summary.length)
        }

        if (current_salary) {
          // metadata JSONB 업데이트
          const { data: currentCandidate, error: fetchMetadataError } = await supabaseAdmin
            .from('candidates')
            .select('metadata')
            .eq('id', candidateId)
            .single()

          if (fetchMetadataError) {
            console.error('[recommendation send] Fetch metadata error:', fetchMetadataError)
          }

          updateData.metadata = {
            ...(currentCandidate?.metadata || {}),
            current_salary
          }
          console.log('[recommendation send] current_salary:', current_salary)
        }

        if (Object.keys(updateData).length > 0) {
          console.log('[recommendation send] Update data keys:', Object.keys(updateData))
          const { error: candidateUpdateError } = await supabaseAdmin
            .from('candidates')
            .update(updateData)
            .eq('id', candidateId)

          if (candidateUpdateError) {
            console.error('[recommendation send] Candidate update error:', candidateUpdateError)
            console.error('[recommendation send] Update data:', updateData)
            // 후보자 업데이트 실패해도 계속 진행 (추천 전송은 수행)
          } else {
            console.log('[recommendation send] ✅ Candidate info updated')
          }
        } else {
          console.log('[recommendation send] No candidate data to update')
        }
      } catch (candidateError) {
        console.error('[recommendation send] Candidate update exception:', candidateError)
        // 후보자 업데이트 실패해도 계속 진행
      }
    }

    // 상태 업데이트: pending → recommended
    const { error: updateError } = await supabaseAdmin
      .from('jd_recommendations')
      .update({
        status: 'recommended',
        recommended_by: profile.email,
        recommended_at: new Date().toISOString(),
        admin_comment: admin_comment || null
      })
      .eq('id', id)

    if (updateError) {
      console.error('[recommendation send] Update error:', updateError)
      return NextResponse.json({ error: '업데이트 실패' }, { status: 500 })
    }

    console.log('[recommendation send] ✅ Status updated to recommended')

    // PM에게 텔레그램 알림
    if (recommendation.recommended_to) {
      const { data: pmProfile } = await supabaseAdmin
        .from('profiles')
        .select('telegram_chat_id, full_name')
        .eq('email', recommendation.recommended_to)
        .single()

      if (pmProfile?.telegram_chat_id) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jobizic-biz.vercel.app'
        const isHttps = appUrl.startsWith('https://')

        const message = `💼 <b>[후보자 추천]</b>

👤 관리자: ${profile.full_name || profile.email.split('@')[0]}
🏢 JD: ${(recommendation as any).job_descriptions.company} - ${(recommendation as any).job_descriptions.position}
👨‍💼 후보자: ${(recommendation as any).candidates.name} (${(recommendation as any).candidates.current_position || '포지션 미상'})
📊 매칭 점수: ${recommendation.match_score}점
${admin_comment ? `\n💬 코멘트: ${admin_comment}` : ''}

추천 페이지에서 확인하세요!`

        try {
          await sendTelegramMessage({
            chatId: pmProfile.telegram_chat_id,
            text: message,
            parseMode: 'HTML',
            ...(isHttps && {
              replyMarkup: {
                inline_keyboard: [[
                  { text: '📋 추천 확인하기', url: `${appUrl}/recommendations` }
                ]]
              }
            })
          })
          console.log('[recommendation send] ✅ Telegram sent to PM')
        } catch (err) {
          console.error('[recommendation send] Telegram error:', err)
        }
      }
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[recommendation send] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

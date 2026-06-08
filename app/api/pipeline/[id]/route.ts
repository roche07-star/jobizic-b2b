import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTelegramMessage } from '@/lib/telegram'
import { createNotification } from '@/lib/notifications'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { data, error } = await supabaseAdmin
      .from('pipeline')
      .select(`
        *,
        job_descriptions (*),
        candidates (*)
      `)
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[api/pipeline/[id] GET]', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const rawBody = await req.json()
    const { stage, updated_by, ...body } = rawBody  // updated_by는 알림용, DB 저장 안 함

    // 기존 파이프라인 데이터 조회
    const { data: oldPipeline } = await supabaseAdmin
      .from('pipeline')
      .select(`
        *,
        job_descriptions (id, position, company, created_by, organization_id),
        candidates (id, name)
      `)
      .eq('id', id)
      .single()

    // Stage Gate: Searcher는 "제안" 단계까지만 변경 가능
    console.log('[Pipeline PATCH] Stage change check:', {
      hasStage: !!stage,
      hasUpdatedBy: !!updated_by,
      oldStage: oldPipeline?.stage,
      newStage: stage
    })

    if (stage && updated_by) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, id, full_name')
        .eq('email', updated_by)
        .single()

      if (profile && profile.role === 'searcher') {
        const restrictedStages = ['클라이언트 제출', '1차 면접', '2차 면접', '최종 면접', '합격', '탈락', 'submitted', 'interview', 'offer', 'hired', 'rejected']
        if (restrictedStages.some(s => stage.toLowerCase().includes(s.toLowerCase()))) {
          return NextResponse.json(
            { error: 'Searcher는 "제안" 단계까지만 진행할 수 있습니다. PM 또는 Owner에게 문의하세요.' },
            { status: 403 }
          )
        }
      }

      // 단계 변경 시 알림 생성
      if (oldPipeline && stage && stage !== oldPipeline.stage) {
        console.log('[Pipeline PATCH] Stage changed:', {
          oldStage: oldPipeline.stage,
          newStage: stage,
          updatedBy: updated_by,
          recommender: oldPipeline.created_by
        })

        const jd = oldPipeline.job_descriptions as any
        const candidate = oldPipeline.candidates as any

        // 1. JD 담당자(PM)에게 알림 - 자신의 JD인 경우만
        if (jd?.created_by && profile) {
          const { data: jdOwner } = await supabaseAdmin
            .from('profiles')
            .select('id, role')
            .eq('email', jd.created_by)
            .single()

          // PM/Owner가 자신의 JD이고, 본인이 변경한 것이 아니면 알림
          if (jdOwner && jdOwner.id !== profile.id && (jdOwner.role === 'headhunter' || jdOwner.role === 'owner')) {
            await createNotification({
              userId: jdOwner.id,
              type: 'pipeline_stage',
              title: `파이프라인 단계 변경: ${candidate?.name || '후보자'}`,
              message: `${jd.position} 포지션의 "${candidate?.name || '후보자'}" 단계가 "${oldPipeline.stage}" → "${stage}"로 변경되었습니다.`,
              relatedId: id,
              relatedType: 'pipeline',
              actionUrl: `/pipeline`,
              senderId: profile.id,
              senderName: profile.full_name || updated_by,
            })
          }
        }

        // 1-2. 관심 등록한 사용자들에게도 알림 (본인 제외, JD 담당자 제외)
        if (jd?.id && profile) {
          const { data: interests } = await supabaseAdmin
            .from('jd_interests')
            .select('user_id, profiles(id, full_name, email)')
            .eq('jd_id', jd.id)

          if (interests && interests.length > 0) {
            for (const interest of interests) {
              const interestProfile = Array.isArray(interest.profiles) ? interest.profiles[0] : interest.profiles
              // 본인이거나 JD 담당자는 제외
              if (interestProfile && interestProfile.id !== profile.id && interestProfile.email !== jd.created_by) {
                await createNotification({
                  userId: interestProfile.id,
                  type: 'pipeline_stage',
                  title: `관심 JD 파이프라인 변경: ${candidate?.name || '후보자'}`,
                  message: `${jd.position} 포지션의 "${candidate?.name || '후보자'}" 단계가 "${oldPipeline.stage}" → "${stage}"로 변경되었습니다.`,
                  relatedId: id,
                  relatedType: 'pipeline',
                  actionUrl: `/pipeline`,
                  senderId: profile.id,
                  senderName: profile.full_name || updated_by,
                })
              }
            }
          }
        }

        // 2. 후보자 등록자(Searcher)에게 알림 - 자신의 후보자인 경우만
        if (oldPipeline.candidate_created_by && profile) {
          const { data: candidateOwner } = await supabaseAdmin
            .from('profiles')
            .select('id, role')
            .eq('email', oldPipeline.candidate_created_by)
            .single()

          // Searcher가 자신의 후보자이고, 본인이 변경한 것이 아니면 알림
          if (candidateOwner && candidateOwner.id !== profile.id && candidateOwner.role === 'searcher') {
            await createNotification({
              userId: candidateOwner.id,
              type: 'pipeline_stage',
              title: `후보자 진행 단계 변경: ${candidate?.name || '후보자'}`,
              message: `"${candidate?.name || '후보자'}" 후보자의 단계가 "${oldPipeline.stage}" → "${stage}"로 변경되었습니다.`,
              relatedId: id,
              relatedType: 'pipeline',
              actionUrl: `/pipeline`,
              senderId: profile.id,
              senderName: profile.full_name || updated_by,
            })
          }
        }

        // 3. 텔레그램 알림 - 추천자에게 (본인이 변경한 것이 아닌 경우)
        console.log('[Pipeline PATCH] Recommender check:', {
          recommender: oldPipeline.created_by,
          updatedBy: updated_by,
          isSamePerson: oldPipeline.created_by === updated_by,
          hasProfile: !!profile
        })

        if (oldPipeline.created_by && profile && oldPipeline.created_by !== updated_by) {
          const { data: recommender } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, email, telegram_chat_id')
            .eq('email', oldPipeline.created_by)
            .single()

          console.log('[Pipeline PATCH] Recommender profile:', {
            email: recommender?.email,
            fullName: recommender?.full_name,
            hasTelegramChatId: !!recommender?.telegram_chat_id,
            chatId: recommender?.telegram_chat_id
          })

          if (recommender?.telegram_chat_id) {
            try {
              const stageEmoji = getStageEmoji(stage)
              const recommenderName = recommender.full_name || oldPipeline.created_by.split('@')[0]

              const telegramMessage = `${stageEmoji} <b>[${stage}]</b>

🏢 회사: ${jd?.company || '회사명 미상'}
💼 포지션: ${jd?.position || '포지션명 미상'}
👤 후보자: ${candidate?.name || '후보자명 미상'}
✍️ 추천자: ${recommenderName}

단계가 변경되었습니다! 🎉`

              await sendTelegramMessage({
                chatId: recommender.telegram_chat_id,
                text: telegramMessage,
                parseMode: 'HTML',
                replyMarkup: {
                  inline_keyboard: [[
                    { text: '🌐 파이프라인 보기', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://jobizic-biz.vercel.app'}/pipeline` }
                  ]]
                }
              })
              console.log('[Pipeline PATCH] Telegram sent to recommender:', oldPipeline.created_by)
            } catch (err) {
              console.error('[Pipeline PATCH] Telegram send failed:', err)
            }
          }
        }
      }
    }

    // 단계별 이모지 헬퍼
    function getStageEmoji(stage: string): string {
      const emojiMap: Record<string, string> = {
        '신규': '🆕',
        '서류검토': '📄',
        '1차면접': '👤',
        '2차면접': '👥',
        '최종면접': '🎯',
        '처우협의': '💰',
        '합격': '✅',
        '불합격': '❌',
        '포기': '⏸️',
      }
      return emojiMap[stage] || '📌'
    }

    // DB 업데이트 데이터 준비
    const updateData: any = {
      ...body,
      last_activity_at: new Date().toISOString()
    }

    // stage가 있으면 포함 (중요!)
    if (stage) {
      updateData.stage = stage
    }

    console.log('[Pipeline PATCH] Updating DB:', { id, stage, fieldsCount: Object.keys(updateData).length })

    const { error } = await supabaseAdmin
      .from('pipeline')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('[Pipeline PATCH] DB update failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Pipeline PATCH] DB update success:', { id, stage })
    return NextResponse.json({ ok: true, stage })
  } catch (e) {
    console.error('[api/pipeline/[id] PATCH]', e)
    return NextResponse.json({ error: '업데이트 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // 권한 확인: JD Owner만 제거 가능
    const userEmail = req.nextUrl.searchParams.get('user_email')

    if (!userEmail) {
      return NextResponse.json({
        error: '인증 정보가 필요합니다.'
      }, { status: 401 })
    }

    // 파이프라인 정보 조회 (JD owner 확인용)
    const { data: pipeline } = await supabaseAdmin
      .from('pipeline')
      .select(`
        id,
        job_descriptions (created_by)
      `)
      .eq('id', id)
      .single()

    if (!pipeline) {
      return NextResponse.json({
        error: '파이프라인을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    const jd = pipeline.job_descriptions as any

    // JD Owner 또는 Admin만 삭제 가능
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('email', userEmail)
      .single()

    const isJDOwner = jd?.created_by === userEmail
    const isAdmin = userProfile?.role === 'admin'

    if (!isJDOwner && !isAdmin) {
      return NextResponse.json({
        error: '권한이 없습니다. JD Owner만 프로세스에서 제거할 수 있습니다.'
      }, { status: 403 })
    }

    // 삭제 실행
    const { error } = await supabaseAdmin
      .from('pipeline')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    console.log('[pipeline DELETE] Removed by:', userEmail, 'JD Owner:', jd?.created_by)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/pipeline/[id] DELETE]', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

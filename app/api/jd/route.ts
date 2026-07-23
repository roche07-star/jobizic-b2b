import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyOrganizationMembers } from '@/lib/notifications'
import { sendTelegramMessage } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  try {
    // 쿼리 파라미터에서 organization_id 받기 (클라이언트에서 전달)
    const organizationId = req.nextUrl.searchParams.get('organization_id')
    const role = req.nextUrl.searchParams.get('role')
    const userEmail = req.nextUrl.searchParams.get('user_email')
    const status = req.nextUrl.searchParams.get('status')
    const onlyInterests = req.nextUrl.searchParams.get('only_interests') === 'true'

    let q = supabaseAdmin
      .from('job_descriptions')
      .select(`
        *,
        created_by_user:profiles!fk_jd_created_by_profile(id, full_name, email),
        organizations(id, name),
        pipeline!pipeline_jd_id_fkey(
          id,
          stage,
          candidate_id,
          candidates(id, name, email, current_company, current_position)
        )
      `)
      .order('created_at', { ascending: false })

    // Role 기반 필터링
    console.log('[jd] User:', userEmail, 'Role:', role)

    // organization_id 필터링
    if (organizationId && role === 'admin') {
      // Admin만 organization_id 파라미터로 조직 선택 가능
      q = q.eq('organization_id', organizationId)
    }

    // Admin은 조직 전체 JD 조회 (organizationId 파라미터로 선택)
    // Owner/Headhunter는 본인 JD + 관심 JD + 활성 JD (현재 조직 내에서만)
    // 기타 사용자는 본인 JD 또는 활성 JD (현재 조직 내에서만)
    if (role && role !== 'admin' && userEmail) {
      // 먼저 현재 사용자의 organization_id 조회 (조직 격리를 위해 필수!)
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, organization_id')
        .eq('email', userEmail)
        .single()

      if (!userProfile?.organization_id) {
        console.warn('[jd] User has no organization_id:', userEmail)
        return NextResponse.json({ jds: [] }, { status: 200 })
      }

      if (role === 'headhunter' || role === 'owner') {
        // Owner/Headhunter: 관심 등록한 JD도 포함
        const { data: interests } = await supabaseAdmin
          .from('jd_interests')
          .select('jd_id')
          .eq('user_id', userProfile.id)

        const interestedJdIds = interests?.map(i => i.jd_id) ?? []

        console.log('[jd] User interests:', interestedJdIds.length, 'JDs')

        if (onlyInterests) {
          // only_interests=true: 관심 JD만 (조직 무관, status 필터는 별도 적용)
          console.log('[jd] Only showing interested JDs (no org filter)')
          if (interestedJdIds.length > 0) {
            q = q.in('id', interestedJdIds)
          } else {
            // 관심 JD가 없으면 빈 결과 반환
            q = q.eq('id', '00000000-0000-0000-0000-000000000000') // 존재하지 않는 ID
          }
        } else {
          // 일반 조회: 조직 격리 적용
          console.log('[jd] Filtering by user organization_id:', userProfile.organization_id)
          q = q.eq('organization_id', userProfile.organization_id)

          if (interestedJdIds.length > 0) {
            // 일반 조회: 본인 JD OR 관심 JD OR 활성 JD (현재 조직 내에서만)
            q = q.or(`created_by.eq.${userEmail},id.in.(${interestedJdIds.join(',')}),status.eq.활성`)
          } else {
            // 관심 JD 없으면 본인 JD OR 활성 JD (현재 조직 내에서만)
            q = q.or(`created_by.eq.${userEmail},status.eq.활성`)
          }
        }
      } else {
        // 기타 role: 본인 JD OR 활성 JD (현재 조직 내에서만)
        if (!onlyInterests) {
          q = q.eq('organization_id', userProfile.organization_id)
        }
        q = q.or(`created_by.eq.${userEmail},status.eq.활성`)
      }
    }

    // 관심 JD는 status 무관하게 모두 표시
    if (status && !onlyInterests) {
      q = q.eq('status', status)
    }

    const { data, error } = await q

    if (error) {
      console.error('[jd] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[jd] Found:', data?.length, 'JDs')
    if (data && data.length > 0) {
      console.log('[jd] Sample created_by values:', data.slice(0, 3).map(j => j.created_by))
    }

    // 각 JD에 진행 중인 후보자 수 추가 (합격/불합격/포기 제외)
    const enrichedData = data?.map((jd: any) => {
      const activeCandidates = jd.pipeline?.filter((p: any) =>
        p.stage && !['합격', '불합격', '포기'].includes(p.stage)
      ) ?? []

      return {
        ...jd,
        active_candidates: activeCandidates
      }
    })

    return NextResponse.json({ jds: enrichedData ?? [] })
  } catch (e: any) {
    console.error('[api/jd GET]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { created_by, organization_id, company, position } = body

    // 권한 체크: PM/owner만 JD 등록 가능
    if (created_by) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('email', created_by)
        .single()

      if (profile && profile.role === 'operator') {
        return NextResponse.json(
          { error: 'Operator는 JD를 등록할 수 없습니다. Owner 또는 Headhunter에게 문의하세요.' },
          { status: 403 }
        )
      }
    }

    // 중복 체크: 동일 조직 내 동일 회사+포지션 조합 확인
    console.log('[JD POST] Checking duplicates:', { organization_id, company, position })

    if (organization_id && company && position) {
      const { data: existingJD, error: dupCheckError } = await supabaseAdmin
        .from('job_descriptions')
        .select('id, position, company, status')
        .eq('organization_id', organization_id)
        .eq('company', company)
        .eq('position', position)
        .not('status', 'in', '("종료","보류")') // 종료/보류 제외, 나머지는 모두 중복 체크
        .maybeSingle()

      if (dupCheckError) {
        console.error('[JD POST] Duplicate check error:', dupCheckError)
      }

      console.log('[JD POST] Duplicate check result:', existingJD ? 'FOUND' : 'NOT FOUND', existingJD)

      if (existingJD) {
        console.log('[JD POST] ❌ Duplicate JD found:', existingJD)
        return NextResponse.json(
          {
            error: `❌ 동일한 JD가 이미 존재합니다.\n\n회사: ${company}\n포지션: ${position}\n상태: ${existingJD.status}\n\n💡 기존 JD를 수정하시거나, 기존 JD를 종료 처리 후 다시 등록해주세요.`,
            existingJdId: existingJD.id
          },
          { status: 409 } // 409 Conflict
        )
      }
    } else {
      console.log('[JD POST] ⚠️ Skipping duplicate check - missing required fields')
    }

    const { data, error } = await supabaseAdmin
      .from('job_descriptions')
      .insert(body)
      .select('id, position, company, organization_id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    console.log('[JD POST] Created JD:', { id: data.id, org_id: data.organization_id, created_by })

    // 새 JD 등록 알림 - 조직 멤버들에게 (본인 제외)
    if (data.organization_id && created_by) {
      console.log('[JD POST] Sending notifications to organization:', data.organization_id)
      const { data: creator } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', created_by)
        .single()

      if (creator) {
        console.log('[JD POST] Creator found:', { id: creator.id, name: creator.full_name })

        // 1. 웹 알림 (기존)
        const notifications = await notifyOrganizationMembers(
          data.organization_id,
          {
            type: 'new_jd',
            title: '새 JD 등록',
            message: `${data.company || '회사'} - ${data.position} 포지션이 등록되었습니다.`,
            relatedId: data.id,
            relatedType: 'jd',
            actionUrl: '/jd',
            senderId: creator.id,
            senderName: creator.full_name || created_by,
          },
          creator.id // 본인 제외
        )
        console.log('[JD POST] Notifications sent:', notifications.length)

        // 2. 텔레그램 알림 (신규)
        // 조직 내 텔레그램 연동된 멤버 조회 (본인 제외)
        console.log('[JD POST] Telegram: Looking for members in organization:', data.organization_id, 'excluding creator:', creator.id)
        const { data: telegramMembers, error: telegramError } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, email, telegram_chat_id')
          .eq('organization_id', data.organization_id)
          .not('telegram_chat_id', 'is', null)
          .neq('id', creator.id)

        if (telegramError) {
          console.error('[JD POST] Telegram members query error:', telegramError)
        }

        console.log('[JD POST] Telegram members found:', telegramMembers?.length || 0, telegramMembers?.map(m => ({ email: m.email, hasChat: !!m.telegram_chat_id })))

        if (telegramMembers && telegramMembers.length > 0) {
          console.log('[JD POST] Sending Telegram notifications to', telegramMembers.length, 'members')
          console.log('[JD POST] TELEGRAM_BOT_TOKEN configured:', !!process.env.TELEGRAM_BOT_TOKEN)

          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jobizic-biz.vercel.app'
          const isHttps = appUrl.startsWith('https://')
          console.log('[JD POST] NEXT_PUBLIC_APP_URL:', appUrl, 'isHttps:', isHttps)

          const creatorName = creator.full_name || creator.email.split('@')[0]
          const telegramMessage = `🆕 <b>[신규 JD]</b>

👤 등록자: ${creatorName}
🏢 회사: ${data.company || '회사명 미상'}
💼 포지션: ${data.position}

자세한 내용은 웹에서 확인하세요!`

          // 모든 멤버에게 텔레그램 메시지 전송
          for (const member of telegramMembers) {
            try {
              console.log('[JD POST] Sending Telegram to:', member.email, 'chat_id:', member.telegram_chat_id)
              const success = await sendTelegramMessage({
                chatId: member.telegram_chat_id!,
                text: telegramMessage,
                parseMode: 'HTML',
                // 텔레그램은 HTTPS URL만 지원 (로컬 환경에서는 버튼 없이)
                ...(isHttps && {
                  replyMarkup: {
                    inline_keyboard: [[
                      { text: '🌐 JD 보러가기', url: `${appUrl}/jd` }
                    ]]
                  }
                })
              })
              console.log('[JD POST] Telegram result for', member.email, ':', success ? '✅ SUCCESS' : '❌ FAILED')
            } catch (err) {
              console.error('[JD POST] Telegram send failed for', member.email, err)
            }
          }
        } else {
          console.log('[JD POST] No Telegram members found')
        }
      } else {
        console.log('[JD POST] Creator not found for email:', created_by)
      }
    } else {
      console.log('[JD POST] Skipping notifications - missing org_id or created_by')
    }

    return NextResponse.json({ id: data.id })
  } catch (e) {
    console.error('[api/jd POST]', e)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

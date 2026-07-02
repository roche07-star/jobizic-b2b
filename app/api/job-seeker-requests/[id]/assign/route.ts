import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 헤드헌터 할당
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 권한 확인 (Admin만 가능)
    const profile = await getProfile()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { headhunter_id, headhunter_email, headhunter_name } = body

    console.log('👤 헤드헌터 할당:', { requestId: id, headhunter_id })

    if (!headhunter_id && !headhunter_email) {
      return NextResponse.json(
        { error: 'headhunter_id or headhunter_email required' },
        { status: 400 }
      )
    }

    // 요청 정보 조회
    const { data: jobSeekerRequest, error: fetchError } = await supabase
      .from('job_seeker_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !jobSeekerRequest) {
      console.error('요청 정보 조회 실패:', fetchError)
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Eve DB 업데이트
    const { error: updateError } = await supabase
      .from('job_seeker_requests')
      .update({
        assigned_headhunter_id: headhunter_id,
        assigned_at: new Date().toISOString(),
        request_status: 'assigned'
      })
      .eq('id', id)

    if (updateError) {
      console.error('DB 업데이트 실패:', updateError)
      throw new Error('Failed to assign headhunter')
    }

    console.log('✅ Eve DB 업데이트 완료')

    // Adam 웹훅 호출
    const adamWebhookUrl = process.env.ADAM_WEBHOOK_URL || 'https://jobizic.vercel.app'
    const eveToAdamApiKey = process.env.EVE_TO_ADAM_API_KEY

    if (eveToAdamApiKey) {
      try {
        const webhookRes = await fetch(`${adamWebhookUrl}/api/webhooks/headhunter-assigned`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-eve-api-key': eveToAdamApiKey
          },
          body: JSON.stringify({
            adam_application_id: jobSeekerRequest.adam_application_id,
            headhunter_id: headhunter_email || headhunter_id,
            headhunter_name: headhunter_name || '헤드헌터',
            eve_request_id: id
          })
        })

        if (!webhookRes.ok) {
          console.error('Adam 웹훅 실패:', await webhookRes.text())
        } else {
          console.log('✅ Adam 웹훅 호출 완료')
        }
      } catch (webhookError) {
        console.error('Adam 웹훅 호출 중 오류:', webhookError)
      }
    } else {
      console.warn('⚠️ EVE_TO_ADAM_API_KEY 없음 - 웹훅 스킵')
    }

    return NextResponse.json({
      success: true,
      message: 'Headhunter assigned successfully',
      request: {
        id,
        assigned_headhunter_id: headhunter_id,
        request_status: 'assigned'
      }
    })

  } catch (error: any) {
    console.error('헤드헌터 할당 중 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

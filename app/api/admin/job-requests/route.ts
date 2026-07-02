import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 60

/**
 * GET /api/admin/job-requests
 * 구직 요청 목록 조회 (관리자)
 */
export async function GET(req: NextRequest) {
  try {
    // API Key 검증 (내부 관리자 페이지에서 호출)
    const apiKey = req.headers.get('X-API-Key')
    if (apiKey && apiKey !== process.env.EVE_TO_ADAM_API_KEY) {
      return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'

    const { data: requests, error } = await supabaseAdmin
      .from('job_requests')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Eve] Job requests fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch job requests' }, { status: 500 })
    }

    return NextResponse.json({ requests })

  } catch (err) {
    console.error('[Eve] GET /api/admin/job-requests error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/job-requests
 * Adam에서 구직 요청 전송 시 호출
 */
export async function POST(req: NextRequest) {
  try {
    // API Key 검증
    const apiKey = req.headers.get('X-API-Key')
    if (apiKey !== process.env.ADAM_TO_EVE_API_KEY) {
      return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      email,
      phone,
      position,
      message,
      adam_user_email,
      adam_application_id,
      adam_analysis_id,
      adam_analysis_data
    } = body

    console.log('[Eve] 구직 요청 수신:', {
      name,
      email,
      position,
      adam_application_id
    })

    // job_requests 테이블에 저장
    const { data: request, error } = await supabaseAdmin
      .from('job_requests')
      .insert({
        name: name || '이름 미입력',
        email,
        phone,
        position,
        message,
        adam_user_email,
        adam_application_id,
        adam_analysis_id,
        adam_analysis_data,
        status: 'pending',
        source: 'adam'
      })
      .select()
      .single()

    if (error) {
      console.error('[Eve] Job request insert error:', error)
      return NextResponse.json({ error: 'Failed to create job request' }, { status: 500 })
    }

    console.log('[Eve] ✅ 구직 요청 저장 완료:', request.id)

    return NextResponse.json({
      success: true,
      request_id: request.id
    })

  } catch (err) {
    console.error('[Eve] POST /api/admin/job-requests error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

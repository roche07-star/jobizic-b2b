import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 60

/**
 * POST /api/super-admin/candidates/:id/job-request
 * Adam (B2C)에서 구직 요청 시 호출
 *
 * 구직자가 헤드헌터 도움을 요청한 경우 배지 표시용
 * API Key 인증 필요
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // API Key 검증
    const apiKey = req.headers.get('X-API-Key')
    if (apiKey !== process.env.ADAM_TO_EVE_API_KEY) {
      return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 })
    }

    const body = await req.json()
    const {
      position,
      request_message,
      application_id,
      requested_at,
      source = 'adam'
    } = body

    console.log('[Eve] 구직 요청 알림 수신:', {
      candidate_id: id,
      position,
      source
    })

    // 기존 후보자 확인
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('candidates')
      .select('id, metadata, name, email')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      console.error('[Eve] Candidate not found:', id, fetchError)
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // metadata에 구직 요청 정보 추가
    const updatedMetadata = {
      ...(existing.metadata || {}),
      job_request: {
        position,
        request_message,
        application_id,
        requested_at: requested_at || new Date().toISOString(),
        source,
        has_active_request: true
      },
      last_job_request_at: requested_at || new Date().toISOString()
    }

    // 후보자 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
        // status를 'active'로 변경 (구직 요청 중)
        status: 'active'
      })
      .eq('id', id)

    if (updateError) {
      console.error('[Eve] Candidate update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update candidate' },
        { status: 500 }
      )
    }

    console.log('[Eve] ✅ 구직 요청 배지 추가 완료:', {
      candidate_id: id,
      name: existing.name,
      email: existing.email
    })

    return NextResponse.json({
      success: true,
      message: '구직 요청이 등록되었습니다.',
      candidate_id: id
    })

  } catch (err) {
    console.error('[Eve] Job request endpoint error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

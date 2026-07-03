import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/webhooks/job-request
 * Supabase Database Webhook: job_requests INSERT 이벤트
 */
export async function POST(req: NextRequest) {
  try {
    // 🔒 Webhook 시크릿 검증
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.SUPABASE_WEBHOOK_SECRET}`

    if (!process.env.SUPABASE_WEBHOOK_SECRET) {
      console.error('[Webhook] SUPABASE_WEBHOOK_SECRET 환경변수 없음')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    if (authHeader !== expectedAuth) {
      console.warn('[Webhook] 인증 실패:', { authHeader })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Webhook payload
    const payload = await req.json()

    console.log('[Webhook] 🔔 새 구직 요청!', {
      type: payload.type,
      table: payload.table,
      record_id: payload.record?.id,
      record_name: payload.record?.name,
      timestamp: new Date().toISOString()
    })

    // Supabase Webhook payload 구조:
    // {
    //   type: 'INSERT' | 'UPDATE' | 'DELETE',
    //   table: 'job_requests',
    //   schema: 'public',
    //   record: { id, name, email, position, ... },
    //   old_record: null (INSERT인 경우)
    // }

    if (payload.type === 'INSERT' && payload.table === 'job_requests') {
      // 여기서 추가 처리 가능:
      // - 관리자에게 이메일 발송
      // - Slack 알림
      // - 푸시 알림 서비스 호출

      console.log('[Webhook] ✅ INSERT 이벤트 처리 완료')
    }

    return NextResponse.json({
      success: true,
      received_at: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[Webhook] ❌ 오류:', error)
    return NextResponse.json({
      error: 'Internal error',
      message: error.message
    }, { status: 500 })
  }
}

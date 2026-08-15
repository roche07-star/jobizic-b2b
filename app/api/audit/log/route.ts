import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/audit/log
 * 접근 로그 기록 (IP 주소 포함)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, actor_email, target_email, target_id, details } = body

    // IP 주소 추출 (Vercel 환경)
    const ip_address =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown'

    // User Agent
    const user_agent = req.headers.get('user-agent') || null

    const supabase = await getSupabaseServer()

    const { error } = await supabase.from('audit_logs').insert({
      action,
      actor_email,
      target_email: target_email || null,
      target_id: target_id || null,
      details: details || {},
      ip_address,
      user_agent,
    })

    if (error) {
      console.error('[audit/log] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[audit/log] Logged:', {
      action,
      actor_email,
      target_email,
      ip_address,
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[audit/log] Error:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/admin/audit-logs
 * 관리자용 접근 로그 조회
 *
 * Query params:
 * - email: 후보자 또는 헤드헌터 이메일 (optional, 필터링용)
 * - limit: 조회 개수 (default: 100, max: 500)
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await getProfile()

    console.log('[admin/audit-logs] Profile:', {
      exists: !!profile,
      role: profile?.role,
      email: profile?.email
    })

    // 관리자만 접근 가능
    if (!profile || profile.role !== 'admin') {
      console.error('[admin/audit-logs] Access denied:', profile)
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const emailFilter = searchParams.get('email')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(parseInt(limitParam || '100'), 500)

    // audit_logs 조회
    let query = supabase()
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    // 이메일 필터 (헤드헌터 또는 후보자)
    if (emailFilter) {
      query = query.or(`actor_email.eq.${emailFilter},target_email.eq.${emailFilter}`)
    }

    const { data: logs, error: logsError } = await query

    if (logsError) {
      console.error('[admin/audit-logs] Query error:', logsError)
      return NextResponse.json({ error: logsError.message }, { status: 500 })
    }

    return NextResponse.json({ logs: logs || [] })
  } catch (e: any) {
    console.error('[admin/audit-logs] Error:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

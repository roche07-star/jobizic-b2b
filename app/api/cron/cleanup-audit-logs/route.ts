import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

/**
 * GET /api/cron/cleanup-audit-logs
 * 2년 이상 된 접근 로그 자동 삭제
 *
 * Vercel Cron Job으로 매월 1일 실행
 */
export async function GET(req: NextRequest) {
  try {
    // Vercel Cron Secret으로 보안 체크
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    console.log('[cleanup-audit-logs] Auth check:', {
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader?.length,
      hasCronSecret: !!process.env.CRON_SECRET,
      cronSecretLength: process.env.CRON_SECRET?.length,
      expectedAuthLength: expectedAuth.length,
      match: authHeader === expectedAuth
    })

    if (authHeader !== expectedAuth) {
      console.error('[cleanup-audit-logs] Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await getSupabaseServer()

    // 2년 이상 된 로그 삭제
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

    const { data: deletedLogs, error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', twoYearsAgo.toISOString())
      .select('id')

    if (error) {
      console.error('[cleanup-audit-logs] Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const deletedCount = deletedLogs?.length || 0

    console.log('[cleanup-audit-logs] Success:', {
      deletedCount,
      cutoffDate: twoYearsAgo.toISOString(),
    })

    return NextResponse.json({
      success: true,
      deletedCount,
      cutoffDate: twoYearsAgo.toISOString(),
      message: `${deletedCount}개의 2년 이상 된 로그 삭제 완료`,
    })
  } catch (e: any) {
    console.error('[cleanup-audit-logs] Error:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerProfile } from '@/lib/supabase-server'
import { getSupabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/admin/cleanup-audit-logs
 * 관리자 전용: 2년 이상 된 접근 로그 수동 삭제
 */
export async function POST(req: NextRequest) {
  try {
    const profile = await getServerProfile()

    // 관리자만 접근 가능
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
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
      console.error('[admin/cleanup-audit-logs] Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const deletedCount = deletedLogs?.length || 0

    console.log('[admin/cleanup-audit-logs] Success:', {
      admin: profile.email,
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
    console.error('[admin/cleanup-audit-logs] Error:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

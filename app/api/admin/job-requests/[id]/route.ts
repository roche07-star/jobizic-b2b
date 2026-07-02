import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * DELETE /api/admin/job-requests/:id
 * 구직 요청 삭제
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log('[Eve] 구직 요청 삭제 시작:', id)

    const { error } = await supabaseAdmin
      .from('job_requests')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Eve] 구직 요청 삭제 실패:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Eve] ✅ 구직 요청 삭제 완료:', id)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[Eve] DELETE /api/admin/job-requests/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// 코멘트 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { commentId } = await params
    const userEmail = req.headers.get('x-user-email')

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 코멘트 정보 조회 (권한 확인용)
    const { data: comment } = await supabaseAdmin
      .from('candidate_comments')
      .select('author_email')
      .eq('id', commentId)
      .single()

    if (!comment) {
      return NextResponse.json({ error: '코멘트를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 작성자만 삭제 가능
    if (comment.author_email !== userEmail) {
      return NextResponse.json({ error: '본인이 작성한 코멘트만 삭제할 수 있습니다.' }, { status: 403 })
    }

    // 코멘트 삭제
    const { error } = await supabaseAdmin
      .from('candidate_comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      console.error('[candidates/comments DELETE] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[candidates/comments DELETE] Exception:', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

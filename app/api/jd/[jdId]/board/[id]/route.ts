import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// 게시글 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: { jdId: string; id: string } }
) {
  try {
    const { jdId, id } = params
    const userEmail = req.headers.get('x-user-email')
    const { title, content } = await req.json()

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!title || !content) {
      return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 })
    }

    // 게시글 조회
    const { data: post } = await supabaseAdmin
      .from('jd_boards')
      .select('*')
      .eq('id', id)
      .eq('jd_id', jdId)
      .single()

    if (!post) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 본인 글만 수정 가능
    if (post.author_email !== userEmail) {
      return NextResponse.json({ error: '본인의 글만 수정할 수 있습니다.' }, { status: 403 })
    }

    // 수정
    const { data, error } = await supabaseAdmin
      .from('jd_boards')
      .update({
        title,
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[jd/board PUT] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ post: data })
  } catch (e) {
    console.error('[jd/board PUT] Exception:', e)
    return NextResponse.json({ error: '수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 게시글 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: { jdId: string; id: string } }
) {
  try {
    const { jdId, id } = params
    const userEmail = req.headers.get('x-user-email')

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 게시글 조회
    const { data: post } = await supabaseAdmin
      .from('jd_boards')
      .select('*')
      .eq('id', id)
      .eq('jd_id', jdId)
      .single()

    if (!post) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 })
    }

    // JD 정보 조회 (소유주 확인)
    const { data: jd } = await supabaseAdmin
      .from('job_descriptions')
      .select('created_by')
      .eq('id', jdId)
      .single()

    if (!jd) {
      return NextResponse.json({ error: 'JD를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 사용자 프로필 조회 (Owner 확인)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('email', userEmail)
      .single()

    // 삭제 권한 체크
    const canDelete =
      post.author_email === userEmail ||  // 본인 글
      jd.created_by === userEmail ||      // JD 소유주
      profile?.role === 'Owner'           // 조직 Owner

    if (!canDelete) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
    }

    // 삭제
    const { error } = await supabaseAdmin
      .from('jd_boards')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[jd/board DELETE] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[jd/board DELETE] Exception:', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

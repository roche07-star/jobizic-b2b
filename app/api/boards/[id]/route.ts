import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/boards/[id] - 게시물 상세 조회
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const userEmail = req.nextUrl.searchParams.get('user_email')

    if (!userEmail) {
      return NextResponse.json({ error: '인증 정보가 필요합니다.' }, { status: 401 })
    }

    // 사용자 프로필 조회
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, organization_id')
      .eq('email', userEmail)
      .single()

    if (!profile) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 게시물 조회
    const { data: board, error } = await supabaseAdmin
      .from('company_boards')
      .select(`
        *,
        author:profiles!author_id (
          id,
          full_name,
          email,
          role
        ),
        organization:organizations (
          id,
          name
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !board) {
      return NextResponse.json({ error: '게시물을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 권한 확인: 자기 조직 또는 Admin
    if (
      board.organization_id !== profile.organization_id &&
      profile.role !== 'admin'
    ) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    // 댓글 조회 (재귀적으로 모든 depth)
    const { data: replies } = await supabaseAdmin
      .from('company_boards')
      .select(`
        *,
        author:profiles!author_id (
          id,
          full_name,
          email,
          role
        )
      `)
      .eq('parent_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    // 조회수 증가
    await supabaseAdmin.rpc('increment_board_view_count', { board_id: id })

    return NextResponse.json({
      ...board,
      replies: replies || []
    })
  } catch (e: any) {
    console.error('[boards/[id] GET] Error:', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// PATCH /api/boards/[id] - 게시물 수정
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { user_email, title, content, image_urls } = body

    if (!user_email) {
      return NextResponse.json({ error: '인증 정보가 필요합니다.' }, { status: 401 })
    }

    // 사용자 프로필 조회
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', user_email)
      .single()

    if (!profile) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 게시물 조회 (권한 확인용)
    const { data: board } = await supabaseAdmin
      .from('company_boards')
      .select('author_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!board) {
      return NextResponse.json({ error: '게시물을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 본인 글만 수정 가능
    if (board.author_id !== profile.id) {
      return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
    }

    // 업데이트
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (image_urls !== undefined) updateData.image_urls = image_urls

    const { error } = await supabaseAdmin
      .from('company_boards')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('[boards/[id] PATCH] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[boards/[id] PATCH] Success:', id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[boards/[id] PATCH] Error:', e)
    return NextResponse.json({ error: '수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// DELETE /api/boards/[id] - 게시물 삭제 (Soft delete)
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const userEmail = req.nextUrl.searchParams.get('user_email')

    if (!userEmail) {
      return NextResponse.json({ error: '인증 정보가 필요합니다.' }, { status: 401 })
    }

    // 사용자 프로필 조회
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('email', userEmail)
      .single()

    if (!profile) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 게시물 조회 (권한 확인용)
    const { data: board } = await supabaseAdmin
      .from('company_boards')
      .select('author_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!board) {
      return NextResponse.json({ error: '게시물을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 본인 글 또는 Admin만 삭제 가능
    if (board.author_id !== profile.id && profile.role !== 'admin') {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
    }

    // Soft delete
    const { error } = await supabaseAdmin
      .from('company_boards')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('[boards/[id] DELETE] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[boards/[id] DELETE] Success:', id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[boards/[id] DELETE] Error:', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

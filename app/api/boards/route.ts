import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createNotification } from '@/lib/notifications'

// GET /api/boards - 게시판 목록 조회
export async function GET(req: NextRequest) {
  try {
    const userEmail = req.nextUrl.searchParams.get('user_email')
    const organizationId = req.nextUrl.searchParams.get('organization_id') // Admin용

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

    // 쿼리 빌더
    let query = supabaseAdmin
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
      .is('deleted_at', null)
      .is('parent_id', null) // 최상위 게시물만 (댓글 제외)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    // Admin은 모든 조직 또는 특정 조직 조회
    if (profile.role === 'admin') {
      if (organizationId && organizationId !== '전체') {
        query = query.eq('organization_id', organizationId)
      }
      // organizationId가 '전체'이면 모든 조직 조회
    } else {
      // 일반 사용자는 자기 조직만
      query = query.eq('organization_id', profile.organization_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('[boards GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 각 게시물의 댓글 개수 조회
    const boardsWithReplies = await Promise.all(
      (data || []).map(async (board) => {
        const { count } = await supabaseAdmin
          .from('company_boards')
          .select('*', { count: 'exact', head: true })
          .eq('parent_id', board.id)
          .is('deleted_at', null)

        return {
          ...board,
          reply_count: count || 0
        }
      })
    )

    return NextResponse.json(boardsWithReplies)
  } catch (e: any) {
    console.error('[boards GET] Error:', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/boards - 게시물 작성
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_email, title, content, parent_id, image_urls } = body

    if (!user_email) {
      return NextResponse.json({ error: '인증 정보가 필요합니다.' }, { status: 401 })
    }

    if (!title && !parent_id) {
      return NextResponse.json({ error: '제목은 필수입니다.' }, { status: 400 })
    }

    if (!content) {
      return NextResponse.json({ error: '내용은 필수입니다.' }, { status: 400 })
    }

    // 사용자 프로필 조회
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, organization_id, full_name')
      .eq('email', user_email)
      .single()

    if (!profile) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 댓글인 경우, 부모 게시물 조회
    let organizationId = profile.organization_id
    let depth = 0
    let parentAuthorId = null

    if (parent_id) {
      const { data: parentBoard } = await supabaseAdmin
        .from('company_boards')
        .select('organization_id, depth, author_id')
        .eq('id', parent_id)
        .single()

      if (!parentBoard) {
        return NextResponse.json({ error: '부모 게시물을 찾을 수 없습니다.' }, { status: 404 })
      }

      organizationId = parentBoard.organization_id
      depth = parentBoard.depth + 1
      parentAuthorId = parentBoard.author_id
    }

    // 게시물 생성
    const { data, error } = await supabaseAdmin
      .from('company_boards')
      .insert({
        organization_id: organizationId,
        author_id: profile.id,
        title: parent_id ? null : title, // 댓글은 제목 없음
        content,
        parent_id: parent_id || null,
        depth,
        image_urls: image_urls || [],
        is_admin_reply: profile.role === 'admin'
      })
      .select()
      .single()

    if (error) {
      console.error('[boards POST] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 알림 전송 (댓글인 경우, 부모 작성자에게)
    if (parent_id && parentAuthorId && parentAuthorId !== profile.id) {
      await createNotification({
        userId: parentAuthorId,
        type: 'board_reply',
        title: '게시판 댓글 알림',
        message: `${profile.full_name || user_email}님이 회신했습니다: ${content.substring(0, 50)}...`,
        relatedId: data.id,
        relatedType: 'board',
        actionUrl: `/boards/${parent_id}`,
        senderId: profile.id,
        senderName: profile.full_name || user_email
      })
    }

    console.log('[boards POST] Success:', data.id)
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('[boards POST] Error:', e)
    return NextResponse.json({ error: '작성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

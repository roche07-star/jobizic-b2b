import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// 코멘트 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userEmail = req.headers.get('x-user-email')

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 코멘트 목록 조회 (최신순, 작성자 정보 포함)
    const { data, error } = await supabaseAdmin
      .from('candidate_comments')
      .select(`
        id,
        candidate_id,
        author_email,
        content,
        created_at,
        profiles:author_id (
          full_name,
          email
        )
      `)
      .eq('candidate_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[candidates/comments GET] Error:', error)
      // 테이블이 없는 경우 빈 배열 반환
      if (error.code === '42P01') {
        return NextResponse.json({ comments: [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ comments: data || [] })
  } catch (e) {
    console.error('[candidates/comments GET] Exception:', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 코멘트 작성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userEmail = req.headers.get('x-user-email')
    const { content } = await req.json()

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: '코멘트 내용을 입력해주세요.' }, { status: 400 })
    }

    // 작성자 ID 조회
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single()

    if (!profile) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 코멘트 작성
    const { data, error } = await supabaseAdmin
      .from('candidate_comments')
      .insert({
        candidate_id: id,
        author_id: profile.id,
        author_email: userEmail,
        content: content.trim(),
      })
      .select(`
        id,
        candidate_id,
        author_email,
        content,
        created_at,
        profiles:author_id (
          full_name,
          email
        )
      `)
      .single()

    if (error) {
      console.error('[candidates/comments POST] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ comment: data })
  } catch (e) {
    console.error('[candidates/comments POST] Exception:', e)
    return NextResponse.json({ error: '작성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

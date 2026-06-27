import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// 게시글 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jdId } = await params
    const userEmail = req.headers.get('x-user-email')

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 접근 권한 확인
    const hasAccess = await checkBoardAccess(jdId, userEmail)
    if (!hasAccess) {
      return NextResponse.json({ error: '게시판 접근 권한이 없습니다.' }, { status: 403 })
    }

    // 게시글 목록 조회 (최신순)
    const { data, error } = await supabaseAdmin
      .from('jd_boards')
      .select('*')
      .eq('jd_id', jdId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[jd/board GET] Error:', error)
      // 테이블이 없는 경우 빈 배열 반환
      if (error.code === '42P01') {
        return NextResponse.json({ posts: [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ posts: data || [] })
  } catch (e) {
    console.error('[jd/board GET] Exception:', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 게시글 작성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jdId } = await params
    const userEmail = req.headers.get('x-user-email')
    const { title, content } = await req.json()

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!title || !content) {
      return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 })
    }

    // 접근 권한 확인
    const hasAccess = await checkBoardAccess(jdId, userEmail)
    if (!hasAccess) {
      return NextResponse.json({ error: '게시판 작성 권한이 없습니다.' }, { status: 403 })
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

    // 게시글 작성
    const { data, error } = await supabaseAdmin
      .from('jd_boards')
      .insert({
        jd_id: jdId,
        author_id: profile.id,
        author_email: userEmail,
        title,
        content,
      })
      .select()
      .single()

    if (error) {
      console.error('[jd/board POST] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ post: data })
  } catch (e) {
    console.error('[jd/board POST] Exception:', e)
    return NextResponse.json({ error: '작성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 게시판 접근 권한 확인 헬퍼 함수
async function checkBoardAccess(jdId: string, userEmail: string): Promise<boolean> {
  // 1. JD 정보 조회
  const { data: jd } = await supabaseAdmin
    .from('job_descriptions')
    .select('created_by, organization_id')
    .eq('id', jdId)
    .single()

  if (!jd) return false

  // 2. 사용자 프로필 조회
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, organization_id')
    .eq('email', userEmail)
    .single()

  if (!profile) return false

  // 3. 권한 체크
  // 3-1. JD 소유주
  if (jd.created_by === userEmail) return true

  // 3-2. 조직 Owner
  if (profile.role === 'Owner' && profile.organization_id === jd.organization_id) return true

  // 3-3. 관심 등록자
  const { data: interest } = await supabaseAdmin
    .from('jd_interests')
    .select('id')
    .eq('jd_id', jdId)
    .eq('user_id', profile.id)
    .single()

  if (interest) return true

  return false
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/candidates/original-resume?candidate_id=xxx
 * 후보자의 원본 이력서 가져오기
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const candidateId = searchParams.get('candidate_id')

    if (!candidateId) {
      return NextResponse.json(
        { error: 'candidate_id가 필요합니다.' },
        { status: 400 }
      )
    }

    // candidates 테이블에서 raw_resume 조회
    const { data, error } = await supabaseAdmin
      .from('candidates')
      .select('id, name, email, current_company, current_position, raw_resume, created_at')
      .eq('id', candidateId)
      .single()

    if (error || !data) {
      console.error('후보자 조회 실패:', error)
      return NextResponse.json(
        { error: '원본 이력서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        name: data.name,
        company: data.current_company,
        position: data.current_position,
        resumeText: data.raw_resume || '',
        createdAt: data.created_at
      }
    })
  } catch (error) {
    console.error('원본 이력서 조회 중 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

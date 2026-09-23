import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/candidates/original-resume?adam_application_id=xxx
 * Adam의 job_applications 테이블에서 원본 이력서 HTML 가져오기
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const adamApplicationId = searchParams.get('adam_application_id')

    if (!adamApplicationId) {
      return NextResponse.json(
        { error: 'adam_application_id가 필요합니다.' },
        { status: 400 }
      )
    }

    // Adam Supabase 연결
    const adamSupabaseUrl = process.env.ADAM_SUPABASE_URL
    const adamSupabaseKey = process.env.ADAM_SUPABASE_SERVICE_ROLE_KEY

    if (!adamSupabaseUrl || !adamSupabaseKey) {
      return NextResponse.json(
        { error: 'Adam Supabase 연결 정보가 없습니다.' },
        { status: 500 }
      )
    }

    const adamSupabase = createClient(adamSupabaseUrl, adamSupabaseKey)

    // job_applications 테이블에서 원본 이력서 조회
    const { data, error } = await adamSupabase
      .from('job_applications')
      .select('id, company, position, applied_to_html, created_at')
      .eq('id', adamApplicationId)
      .single()

    if (error) {
      console.error('Adam job_applications 조회 실패:', error)
      return NextResponse.json(
        { error: '원본 이력서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: '원본 이력서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        company: data.company,
        position: data.position,
        resumeHtml: data.applied_to_html,
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

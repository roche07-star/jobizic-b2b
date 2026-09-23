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

    // job_applications와 jd_analyses를 조인해서 원본 이력서 조회
    const { data, error } = await adamSupabase
      .from('job_applications')
      .select(`
        id,
        company,
        position,
        created_at,
        jd_analysis_id,
        jd_analyses!inner (
          id,
          result
        )
      `)
      .eq('id', adamApplicationId)
      .single()

    if (error) {
      console.error('Adam job_applications 조회 실패:', error)
      return NextResponse.json(
        { error: '원본 이력서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (!data || !data.jd_analyses) {
      return NextResponse.json(
        { error: '원본 이력서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // jd_analyses.result에서 이력서 HTML 추출
    const analysis = Array.isArray(data.jd_analyses) ? data.jd_analyses[0] : data.jd_analyses
    const analysisResult = (analysis as any)?.result || {}
    const resumeHtml = analysisResult.resumeHtml || analysisResult.resume_html || analysisResult.html || ''

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        company: data.company,
        position: data.position,
        resumeHtml: resumeHtml,
        analysisResult: analysisResult,
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

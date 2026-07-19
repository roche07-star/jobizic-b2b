import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const userEmail = req.nextUrl.searchParams.get('user_email') || 'unknown'
    const { jd_id, candidate_id, jd, candidate, client_comment, organization_id, created_by } = await req.json()

    if (!jd_id || !candidate_id) {
      return NextResponse.json({ error: 'JD ID와 후보자 ID가 필요합니다.' }, { status: 400 })
    }

    console.log('[pipeline/match-job] Creating job for pipeline matching...')

    // Job 생성 (백그라운드 처리용)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        job_type: 'pipeline_match',
        status: 'pending',
        input: {
          jd_id,
          candidate_id,
          jd,
          candidate,
          client_comment,
          organization_id,
          created_by
        },
        user_email: userEmail,
        progress: 10,
        message: 'JD-후보자 매칭 대기 중...'
      })
      .select()
      .single()

    if (jobError || !job) {
      console.error('[pipeline/match-job] Job creation failed:', jobError)
      return NextResponse.json({ error: 'Job 생성 실패' }, { status: 500 })
    }

    console.log('[pipeline/match-job] Job created:', job.id)

    // 즉시 jobId 반환 (백그라운드 처리)
    return NextResponse.json({
      jobId: job.id,
      status: 'pending',
      message: '매칭 분석 대기 중... process API를 호출하세요'
    })

  } catch (e: any) {
    console.error('[pipeline/match-job] ❌ FATAL ERROR')
    console.error('[pipeline/match-job] Error:', e.message)

    return NextResponse.json({
      status: 'failed',
      error: '서버 오류가 발생했습니다.',
      details: e.message || 'Unknown error'
    }, { status: 500 })
  }
}

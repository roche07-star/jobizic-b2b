import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  let jobId: string | null = null

  try {
    const userEmail = req.nextUrl.searchParams.get('user_email') || 'unknown'
    const { text, company, position, company_url, client_comment } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: 'JD 내용을 입력해 주세요.' }, { status: 400 })
    }

    console.log('[jd/parse] Creating job for JD parsing...')

    // Job 생성 (백그라운드 처리용)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        job_type: 'jd_parse',
        status: 'pending',
        input: { text, company, position, company_url, client_comment },
        user_email: userEmail,
        progress: 10,
        message: 'JD 분석 대기 중...'
      })
      .select()
      .single()

    if (jobError || !job) {
      console.error('[jd/parse] Job creation failed:', jobError)
      return NextResponse.json({ error: 'Job 생성 실패' }, { status: 500 })
    }

    jobId = job.id
    console.log('[jd/parse] Job created:', job.id)

    // 즉시 jobId 반환 (백그라운드 처리)
    return NextResponse.json({
      jobId: job.id,
      status: 'pending',
      message: '분석 대기 중... process API를 호출하세요'
    })

  } catch (e: any) {
    console.error('[jd/parse] ❌ FATAL ERROR')
    console.error('[jd/parse] Error:', e.message)

    // Job 실패 처리
    if (jobId) {
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error: e.message,
          progress: 0,
          message: '분석 실패',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
    }

    return NextResponse.json({
      jobId,
      status: 'failed',
      error: '서버 오류가 발생했습니다.',
      details: e.message || 'Unknown error'
    }, { status: 500 })
  }
}

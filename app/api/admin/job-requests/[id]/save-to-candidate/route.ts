import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProfile } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

// Adam Supabase 연결 (환경변수 필요)
const adamSupabase = process.env.ADAM_SUPABASE_URL && process.env.ADAM_SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.ADAM_SUPABASE_URL, process.env.ADAM_SUPABASE_SERVICE_ROLE_KEY)
  : null

/**
 * POST /api/admin/job-requests/:id/save-to-candidate
 * 구직 요청을 후보자로 저장
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 관리자 확인
    const profile = await getProfile()
    const savedBy = profile?.email || 'system'

    console.log('[Eve] 후보자 저장 시작:', { id, profile: !!profile })

    // 1. 구직 요청 조회
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('job_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !request) {
      console.error('[Eve] Job request not found:', id)
      return NextResponse.json({ error: 'Job request not found' }, { status: 404 })
    }

    if (request.status === 'saved') {
      return NextResponse.json({
        error: '이미 후보자로 저장되었습니다.',
        candidate_id: request.candidate_id
      }, { status: 400 })
    }

    // 중복 생성 방지: 같은 이메일의 활성 candidate가 이미 있는지 확인 (source 무관)
    const { data: existingCandidate } = await supabaseAdmin
      .from('candidates')
      .select('id, source')
      .eq('email', request.email)
      .eq('status', 'active')
      .maybeSingle()

    if (existingCandidate) {
      // 기존 candidate가 있으면 job_requests 상태만 업데이트
      await supabaseAdmin
        .from('job_requests')
        .update({
          status: 'saved',
          candidate_id: existingCandidate.id,
          saved_by: savedBy,
          saved_at: new Date().toISOString()
        })
        .eq('id', id)

      const isFromAdam = existingCandidate.source === 'adam_job_request'

      return NextResponse.json({
        success: true,
        candidate_id: existingCandidate.id,
        message: isFromAdam
          ? '기존 후보자와 연결되었습니다.'
          : '이미 등록된 후보자입니다. 기존 카드로 연결합니다.'
      })
    }

    // 2. 후보자 생성
    const candidateData: any = {
      name: request.name,
      email: request.email,
      phone: request.phone,
      current_position: request.position,
      status: 'active',
      source: 'adam_job_request',
      raw_resume: request.message,
      metadata: {
        adam_user_email: request.adam_user_email,
        adam_application_id: request.adam_application_id,
        adam_analysis_id: request.adam_analysis_id,
        adam_analysis_data: request.adam_analysis_data,
        job_request: {
          position: request.position,
          message: request.message,
          requested_at: request.created_at,
          has_active_request: true
        }
      }
    }

    // Adam 분석 데이터가 있으면 추가 정보 설정
    console.log('[Eve] Adam 분석 데이터 확인:', {
      has_data: !!request.adam_analysis_data,
      data_type: typeof request.adam_analysis_data,
      data_keys: request.adam_analysis_data ? Object.keys(request.adam_analysis_data) : [],
      raw_data: request.adam_analysis_data
    })

    if (request.adam_analysis_data) {
      // 문자열인 경우 파싱 시도
      let analysis = request.adam_analysis_data as any
      if (typeof analysis === 'string') {
        try {
          analysis = JSON.parse(analysis)
          console.log('[Eve] ✅ JSON 파싱 완료')
        } catch (parseError) {
          console.error('[Eve] ❌ JSON 파싱 실패:', parseError)
          analysis = null
        }
      }

      if (!analysis) {
        console.log('[Eve] ⚠️ 분석 데이터가 없거나 파싱 실패')
      } else {
        console.log('[Eve] 🎯 분석 데이터 매핑 시작:', {
          job_title: analysis.job_title,
          total_experience_years: analysis.total_experience_years,
          has_strengths: !!analysis.strengths,
          has_keywords: !!analysis.keywords,
          has_career_paths: !!analysis.career_paths
        })

        // 경력 연수
        if (analysis.total_experience_years) {
        candidateData['total_experience_years'] = analysis.total_experience_years
        console.log('[Eve] ✅ 경력 연수 설정:', analysis.total_experience_years)
      }

      // 학력
      if (analysis.education) {
        candidateData['education'] = analysis.education
      }

      // 거주지
      if (analysis.address) {
        candidateData['location'] = analysis.address
      }

      // 현재/희망 연봉
      if (analysis.current_salary) {
        candidateData['current_salary'] = analysis.current_salary
      }

      // 직무명 → current_position
      if (analysis.job_title) {
        candidateData['current_position'] = analysis.job_title
      }

      // 강점 → key_highlights + strength_summary
      if (analysis.strengths && Array.isArray(analysis.strengths)) {
        candidateData['key_highlights'] = analysis.strengths
        candidateData['strength_summary'] = analysis.strengths.join('\n\n')
      }

      // 개선점 → weakness_summary
      if (analysis.improvements && Array.isArray(analysis.improvements)) {
        candidateData['weakness_summary'] = analysis.improvements.join('\n\n')
      }

      // keywords → skills + tech_stack
      if (analysis.keywords && Array.isArray(analysis.keywords)) {
        candidateData['skills'] = analysis.keywords
        candidateData['tech_stack'] = analysis.keywords
      }

      // summary → career_summary (파싱해서 구조화)
      if (analysis.summary) {
        candidateData['career_summary'] = analysis.summary

        // summary를 파싱해서 career_trajectory 추출
        const lines = analysis.summary.split('\n').filter((l: string) => l.trim())
        if (lines.length >= 3) {
          // 세 번째 줄이 보통 커리어 패턴
          const careerPattern = lines[2]
          if (careerPattern) {
            candidateData['career_trajectory'] = careerPattern
          }
        }
      }

      // career_paths → ideal_roles
      if (analysis.career_paths && Array.isArray(analysis.career_paths)) {
        const roles = analysis.career_paths.map((path: any) => {
          const salaryInfo = path.salary_range || ''
          const points = path.points?.join(' • ') || ''
          return `${path.title} (${salaryInfo})\n${points}`
        }).join('\n\n')

        candidateData['ideal_roles'] = roles || null

        // 첫 번째 career_path의 title을 current_position으로 사용 (더 구체적)
        if (analysis.career_paths[0]?.title) {
          candidateData['current_position'] = analysis.career_paths[0].title
        }
      }

      // 점수 → market_value
      if (analysis.scores) {
        const avgScore = Math.round(
          (analysis.scores.job_fit + analysis.scores.market_competitiveness + analysis.scores.growth_potential) / 3
        )
        candidateData['market_value'] = `평균 ${avgScore}점\n• 직무 적합도: ${analysis.scores.job_fit}점\n• 시장 경쟁력: ${analysis.scores.market_competitiveness}점\n• 성장 가능성: ${analysis.scores.growth_potential}점`
      }

        console.log('[Eve] ✅ 분석 데이터 매핑 완료:', {
          total_fields_set: Object.keys(candidateData).length,
          has_skills: !!candidateData.skills,
          has_strengths: !!candidateData.key_highlights,
          has_career_summary: !!candidateData.career_summary
        })
      }
    }

    const { data: candidate, error: createError } = await supabaseAdmin
      .from('candidates')
      .insert(candidateData)
      .select()
      .single()

    if (createError) {
      console.error('[Eve] Candidate creation error:', createError)
      return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 })
    }

    // 3. 구직 요청 상태 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('job_requests')
      .update({
        status: 'saved',
        candidate_id: candidate.id,
        saved_by: savedBy,
        saved_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('[Eve] Job request update error:', updateError)
      // 후보자는 생성되었으므로 경고만 로그
    }

    // 4. Adam job_applications 상태 업데이트 (🔴 구직요청 → 🔵 헤드헌터접수)
    if (request.adam_application_id && adamSupabase) {
      try {
        const { error: adamUpdateError } = await adamSupabase
          .from('job_applications')
          .update({
            status: '헤드헌터접수',
            headhunter_status: 'assigned',
            updated_at: new Date().toISOString()
          })
          .eq('id', request.adam_application_id)

        if (adamUpdateError) {
          console.error('[Eve] Adam job_applications update error:', adamUpdateError)
        } else {
          console.log('[Eve] ✅ Adam 상태 업데이트 완료:', {
            application_id: request.adam_application_id,
            status: '헤드헌터접수'
          })
        }
      } catch (adamError) {
        console.error('[Eve] Adam 상태 업데이트 실패 (non-fatal):', adamError)
      }
    } else if (request.adam_application_id && !adamSupabase) {
      console.warn('[Eve] Adam Supabase 연결 없음 - 환경변수 확인 필요')
    }

    console.log('[Eve] ✅ 후보자 저장 완료:', {
      request_id: id,
      candidate_id: candidate.id,
      name: candidate.name
    })

    return NextResponse.json({
      success: true,
      candidate_id: candidate.id,
      message: '후보자로 저장되었습니다.'
    })

  } catch (err) {
    console.error('[Eve] Save to candidate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

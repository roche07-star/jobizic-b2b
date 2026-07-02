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

    // 중복 생성 방지: 같은 이메일의 candidate가 이미 있는지 확인
    const { data: existingCandidate } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('email', request.email)
      .eq('source', 'adam_job_request')
      .single()

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

      return NextResponse.json({
        success: true,
        candidate_id: existingCandidate.id,
        message: '기존 후보자와 연결되었습니다.'
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
    if (request.adam_analysis_data) {
      const analysis = request.adam_analysis_data as any

      if (analysis.total_experience_years) {
        candidateData['total_experience_years'] = analysis.total_experience_years
      }
      if (analysis.current_company) {
        candidateData['current_company'] = analysis.current_company
      }
      if (analysis.skills && Array.isArray(analysis.skills)) {
        candidateData['skills'] = analysis.skills
      }
      if (analysis.strengths && Array.isArray(analysis.strengths)) {
        candidateData['key_highlights'] = analysis.strengths
      }
      if (analysis.career_summary) {
        candidateData['career_summary'] = analysis.career_summary
      }
      if (analysis.education && Array.isArray(analysis.education)) {
        candidateData['education'] = analysis.education
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

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 60

/**
 * POST /api/super-admin/candidates
 * Adam (B2C)에서 회원가입 시 기본 정보 전송
 *
 * API Key 인증 필요
 */
export async function POST(req: NextRequest) {
  try {
    // API Key 검증
    const apiKey = req.headers.get('X-API-Key')
    if (apiKey !== process.env.ADAM_TO_EVE_API_KEY) {
      return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 })
    }

    const {
      name,
      email,
      phone,
      source,
      adam_user_email,
      current_company,
      current_position,
      total_experience_years,
      career_summary,
      work_history,
      raw_resume,
      education,
      skills,
      tech_stack,
      ideal_roles,
      market_value,
      strength_summary,
      weakness_summary,
      career_trajectory,
      key_highlights,
      tags,
      status,
      job_search_status,
      created_by,
      organization_id,
      metadata
    } = await req.json()

    // 필수 필드 검증
    if (!name || !email) {
      return NextResponse.json({
        error: 'name and email are required'
      }, { status: 400 })
    }

    // 중복 체크 (같은 이메일)
    const { data: existing } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('email', email)
      .eq('source', 'adam_signup')
      .single()

    if (existing) {
      // 이미 존재하면 업데이트
      const updateData: any = {
        name,
        email,
        phone: phone || undefined,
        updated_at: new Date().toISOString()
      }

      if (current_company) updateData.current_company = current_company
      if (current_position) updateData.current_position = current_position
      if (total_experience_years !== undefined) updateData.total_experience_years = total_experience_years
      if (career_summary) updateData.career_summary = career_summary
      if (work_history) updateData.work_history = work_history
      if (raw_resume) updateData.raw_resume = raw_resume
      if (education) updateData.education = education
      if (skills) updateData.skills = skills
      if (tech_stack) updateData.tech_stack = tech_stack
      if (ideal_roles) updateData.ideal_roles = ideal_roles
      if (market_value) updateData.market_value = market_value
      if (strength_summary) updateData.strength_summary = strength_summary
      if (weakness_summary) updateData.weakness_summary = weakness_summary
      if (career_trajectory) updateData.career_trajectory = career_trajectory
      if (key_highlights) updateData.key_highlights = key_highlights
      if (tags) updateData.tags = tags
      if (status) updateData.status = status
      if (job_search_status) updateData.job_search_status = job_search_status
      if (metadata) updateData.metadata = metadata

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('candidates')
        .update(updateData)
        .eq('id', existing.id)
        .select('id')
        .single()

      if (updateError) {
        console.error('[super-admin/candidates] Update error:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({
        candidate_id: updated.id,
        message: 'Candidate updated',
        existed: true
      })
    }

    // 새로 등록
    const insertData: any = {
      name,
      email,
      phone: phone || null,
      raw_resume: raw_resume || 'Adam에서 전송됨 (이력서 분석 대기 중)',
      source: source || 'adam_signup',
      organization_id: organization_id || null, // Super Admin 관리 (organization 없음)
      status: status || '검토중',
      metadata: metadata || {
        adam_user_email: adam_user_email || email,
        created_from_adam: true,
        registered_at: new Date().toISOString()
      }
    }

    if (current_company) insertData.current_company = current_company
    if (current_position) insertData.current_position = current_position
    if (total_experience_years !== undefined) insertData.total_experience_years = total_experience_years
    if (career_summary) insertData.career_summary = career_summary
    if (work_history) insertData.work_history = work_history
    if (education) insertData.education = education
    if (skills) insertData.skills = skills
    if (tech_stack) insertData.tech_stack = tech_stack
    if (ideal_roles) insertData.ideal_roles = ideal_roles
    if (market_value) insertData.market_value = market_value
    if (strength_summary) insertData.strength_summary = strength_summary
    if (weakness_summary) insertData.weakness_summary = weakness_summary
    if (career_trajectory) insertData.career_trajectory = career_trajectory
    if (key_highlights) insertData.key_highlights = key_highlights
    if (tags) insertData.tags = tags
    if (job_search_status) insertData.job_search_status = job_search_status
    if (created_by) insertData.created_by = created_by

    const { data: candidate, error: insertError } = await supabaseAdmin
      .from('candidates')
      .insert(insertData)
      .select('id')
      .single()

    if (insertError) {
      console.error('[super-admin/candidates] Insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log('[super-admin/candidates] 새 후보자 등록:', candidate.id)

    return NextResponse.json({
      candidate_id: candidate.id,
      message: 'Candidate created successfully'
    })

  } catch (e: any) {
    console.error('[super-admin/candidates] Unexpected error:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

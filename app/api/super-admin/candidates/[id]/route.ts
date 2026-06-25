import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

/**
 * PUT /api/super-admin/candidates/:id
 * Adam (B2C)에서 이력서 분석 완료 시 업데이트
 *
 * API Key 인증 필요
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // API Key 검증
    const apiKey = req.headers.get('X-API-Key')
    if (apiKey !== process.env.ADAM_TO_EVE_API_KEY) {
      return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 })
    }

    const body = await req.json()
    const {
      total_experience_years,
      job_title,
      current_company,
      current_position,
      current_salary,
      education,
      address,
      skills,
      strengths,
      career_summary,
      analysis_result
    } = body

    const supabase = await createClient()

    // 기존 후보자 확인
    const { data: existing } = await supabase
      .from('candidates')
      .select('id, metadata')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // 업데이트 데이터 구성
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (total_experience_years !== undefined) {
      updateData.total_experience_years = total_experience_years
    }

    if (job_title || current_position) {
      updateData.current_position = job_title || current_position
    }

    if (current_company) {
      updateData.current_company = current_company
    }

    if (current_salary) {
      updateData.market_value = current_salary
    }

    if (education) {
      updateData.education = Array.isArray(education) ? education : [education]
    }

    if (address) {
      updateData.location = address
    }

    if (skills && Array.isArray(skills)) {
      updateData.skills = skills
    }

    if (strengths && Array.isArray(strengths)) {
      updateData.key_highlights = strengths
    }

    if (career_summary) {
      updateData.career_summary = career_summary
    }

    // metadata 업데이트 (분석 결과 전체 저장)
    updateData.metadata = {
      ...(existing.metadata || {}),
      analysis_result,
      analyzed_at: new Date().toISOString()
    }

    // raw_resume 업데이트 (분석 결과로)
    if (analysis_result) {
      updateData.raw_resume = JSON.stringify(analysis_result, null, 2)
    }

    // 업데이트 실행
    const { data: updated, error: updateError } = await supabase
      .from('candidates')
      .update(updateData)
      .eq('id', id)
      .select('id')
      .single()

    if (updateError) {
      console.error('[super-admin/candidates/:id] Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log('[super-admin/candidates/:id] 후보자 업데이트:', updated.id)

    return NextResponse.json({
      success: true,
      candidate_id: updated.id,
      message: 'Candidate updated successfully'
    })

  } catch (e: any) {
    console.error('[super-admin/candidates/:id] PUT error:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * DELETE /api/super-admin/candidates/:id
 * Adam (B2C)에서 헤드헌터 공유 동의 철회 시 삭제
 *
 * API Key 인증 필요
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // API Key 검증
    const apiKey = req.headers.get('X-API-Key')
    if (apiKey !== process.env.ADAM_TO_EVE_API_KEY) {
      return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 })
    }

    const supabase = await createClient()

    // 삭제 실행
    const { error: deleteError } = await supabase
      .from('candidates')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[super-admin/candidates/:id] Delete error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    console.log('[super-admin/candidates/:id] 후보자 삭제:', id)

    return NextResponse.json({
      success: true,
      message: 'Candidate deleted successfully'
    })

  } catch (e: any) {
    console.error('[super-admin/candidates/:id] DELETE error:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

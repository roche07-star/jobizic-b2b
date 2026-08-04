import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const { primaryId, mergeIds } = await req.json()

    if (!primaryId || !mergeIds || !Array.isArray(mergeIds) || mergeIds.length === 0) {
      return NextResponse.json({ error: '잘못된 요청 데이터' }, { status: 400 })
    }

    console.log(`[merge] Merging ${mergeIds.length} candidates into ${primaryId}`)

    // 1. Primary 후보자 조회
    const { data: primary, error: primaryError } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('id', primaryId)
      .single()

    if (primaryError || !primary) {
      return NextResponse.json({ error: '대표 후보자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 2. Merge 후보자들 조회
    const { data: mergeCandidates, error: mergeError } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .in('id', mergeIds)

    if (mergeError || !mergeCandidates || mergeCandidates.length === 0) {
      return NextResponse.json({ error: '병합할 후보자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 3. 데이터 병합 로직
    const allCandidates = [primary, ...mergeCandidates]

    // 3-1. 배열 필드 병합 (중복 제거)
    const mergeArrayFields = (fieldName: string) => {
      const allItems = allCandidates
        .flatMap(c => c[fieldName] || [])
        .filter(Boolean)
      return Array.from(new Set(allItems)) // 중복 제거
    }

    // 3-2. work_history 병합 (회사명 + 기간 기준 중복 제거)
    const mergeWorkHistory = () => {
      const allHistory = allCandidates.flatMap(c => c.work_history || [])
      const uniqueHistory = new Map()

      for (const work of allHistory) {
        const key = `${work.company}:${work.start_date}:${work.end_date || 'current'}`
        if (!uniqueHistory.has(key)) {
          uniqueHistory.set(key, work)
        }
      }

      return Array.from(uniqueHistory.values())
        .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
    }

    // 3-3. 가장 완전한 데이터 선택 (null이 아닌 것 우선)
    const selectBest = (fieldName: string) => {
      for (const candidate of allCandidates) {
        if (candidate[fieldName] !== null && candidate[fieldName] !== undefined && candidate[fieldName] !== '') {
          return candidate[fieldName]
        }
      }
      return primary[fieldName]
    }

    // 3-4. 병합된 데이터
    const mergedData = {
      // 기본 정보 (가장 완전한 것)
      email: selectBest('email'),
      phone: selectBest('phone'),
      birth_year: selectBest('birth_year'),
      location: selectBest('location'),
      current_company: selectBest('current_company'),
      current_position: selectBest('current_position'),

      // 경력 정보
      total_experience_years: Math.max(...allCandidates.map(c => c.total_experience_years || 0)),
      career_summary: selectBest('career_summary'),
      work_history: mergeWorkHistory(),

      // 배열 필드 (중복 제거)
      education: mergeArrayFields('education'),
      skills: mergeArrayFields('skills'),
      tech_stack: mergeArrayFields('tech_stack'),
      certifications: mergeArrayFields('certifications'),
      languages: mergeArrayFields('languages'),
      ideal_roles: mergeArrayFields('ideal_roles'),
      key_highlights: mergeArrayFields('key_highlights'),
      tags: mergeArrayFields('tags'),

      // AI 분석 (가장 완전한 것)
      strength_summary: selectBest('strength_summary'),
      weakness_summary: selectBest('weakness_summary'),
      career_trajectory: selectBest('career_trajectory'),
      market_value: selectBest('market_value'),

      // 원본 이력서 (가장 긴 것)
      raw_resume: allCandidates
        .map(c => c.raw_resume)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] || primary.raw_resume,

      // 메타데이터 병합
      metadata: {
        ...(primary.metadata || {}),
        merged_from: mergeIds,
        merged_at: new Date().toISOString(),
        merged_count: mergeIds.length
      }
    }

    // 4. Primary 후보자 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update(mergedData)
      .eq('id', primaryId)

    if (updateError) {
      console.error('[merge] Update error:', updateError)
      return NextResponse.json({ error: '병합 실패' }, { status: 500 })
    }

    // 5. Pipeline 이동 (merge된 후보자 → primary)
    const { error: pipelineError } = await supabaseAdmin
      .from('pipeline')
      .update({ candidate_id: primaryId })
      .in('candidate_id', mergeIds)

    if (pipelineError) {
      console.warn('[merge] Pipeline update error:', pipelineError)
    }

    // 6. Merge된 후보자 삭제
    const { error: deleteError } = await supabaseAdmin
      .from('candidates')
      .delete()
      .in('id', mergeIds)

    if (deleteError) {
      console.error('[merge] Delete error:', deleteError)
      return NextResponse.json({ error: '중복 후보자 삭제 실패' }, { status: 500 })
    }

    console.log(`[merge] ✅ Successfully merged ${mergeIds.length} candidates into ${primaryId}`)

    return NextResponse.json({
      success: true,
      primaryId,
      mergedCount: mergeIds.length
    })

  } catch (e) {
    console.error('[api/candidates/merge POST]', e)
    return NextResponse.json({ error: '병합 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

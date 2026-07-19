import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getServerProfile } from '@/lib/supabase-server'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const profile = await getServerProfile()

    if (!profile) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { action, pm_comment } = await req.json() // action: 'accept' | 'reject'

    console.log('[recommendation accept] ID:', id, 'action:', action, 'by:', profile.email)

    // 추천 정보 조회 (본인에게 추천된 것만)
    const { data: recommendation, error: fetchError } = await supabaseAdmin
      .from('jd_recommendations')
      .select('*')
      .eq('id', id)
      .eq('recommended_to', profile.email)
      .single()

    if (fetchError || !recommendation) {
      console.error('[recommendation accept] Fetch error:', fetchError)
      return NextResponse.json({ error: '추천을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (recommendation.status !== 'recommended') {
      return NextResponse.json({ error: '이미 처리된 추천입니다.' }, { status: 400 })
    }

    if (action === 'accept') {
      // 1. 상태 업데이트: recommended → accepted
      const { error: updateError } = await supabaseAdmin
        .from('jd_recommendations')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
          pm_comment: pm_comment || null
        })
        .eq('id', id)

      if (updateError) {
        console.error('[recommendation accept] Update error:', updateError)
        return NextResponse.json({ error: '업데이트 실패' }, { status: 500 })
      }

      // 2. 파이프라인에 자동 추가
      const { error: pipelineError } = await supabaseAdmin
        .from('pipeline')
        .insert({
          jd_id: recommendation.jd_id,
          candidate_id: recommendation.candidate_id,
          stage: '추천',
          match_score: recommendation.match_score,
          match_reason: recommendation.match_reason,
          skill_match_rate: recommendation.skill_match_rate,
          experience_match: recommendation.experience_match,
          strength_for_jd: recommendation.strength_for_jd,
          concerns: recommendation.concerns,
          is_active: true,
          organization_id: profile.organization_id,
          created_by: profile.email
        })

      if (pipelineError) {
        console.error('[recommendation accept] Pipeline insert error:', pipelineError)
        // 중복 에러는 무시 (이미 추가된 경우)
        if (!pipelineError.message?.includes('duplicate')) {
          return NextResponse.json({ error: '파이프라인 추가 실패' }, { status: 500 })
        }
      }

      console.log('[recommendation accept] ✅ Added to pipeline')

      return NextResponse.json({
        success: true,
        message: '추천을 수락하고 파이프라인에 추가했습니다.'
      })

    } else if (action === 'reject') {
      // 상태 업데이트: recommended → rejected
      const { error: updateError } = await supabaseAdmin
        .from('jd_recommendations')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
          pm_comment: pm_comment || null
        })
        .eq('id', id)

      if (updateError) {
        console.error('[recommendation accept] Update error:', updateError)
        return NextResponse.json({ error: '업데이트 실패' }, { status: 500 })
      }

      console.log('[recommendation accept] ✅ Rejected')

      return NextResponse.json({
        success: true,
        message: '추천을 거절했습니다.'
      })

    } else {
      return NextResponse.json({ error: '잘못된 action입니다.' }, { status: 400 })
    }

  } catch (error: any) {
    console.error('[recommendation accept] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

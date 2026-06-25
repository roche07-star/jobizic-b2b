import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      adam_user_email
    } = await req.json()

    // 필수 필드 검증
    if (!name || !email || !phone) {
      return NextResponse.json({
        error: 'name, email, phone are required'
      }, { status: 400 })
    }

    const supabase = await createClient()

    // 중복 체크 (같은 이메일)
    const { data: existing } = await supabase
      .from('candidates')
      .select('id')
      .eq('email', email)
      .eq('source', 'adam_signup')
      .single()

    if (existing) {
      // 이미 존재하면 업데이트
      const { data: updated, error: updateError } = await supabase
        .from('candidates')
        .update({
          name,
          phone,
          updated_at: new Date().toISOString()
        })
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
    const { data: candidate, error: insertError } = await supabase
      .from('candidates')
      .insert({
        name,
        email,
        phone,
        raw_resume: 'Adam에서 전송됨 (이력서 분석 대기 중)',
        source: source || 'adam_signup',
        organization_id: null, // Super Admin 관리 (organization 없음)
        status: '검토중',
        metadata: {
          adam_user_email: adam_user_email || email,
          created_from_adam: true,
          registered_at: new Date().toISOString()
        }
      })
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

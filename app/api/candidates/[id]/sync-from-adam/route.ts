import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 30

/**
 * POST /api/candidates/:id/sync-from-adam
 * Adam에서 전화번호-이메일 가져오기
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. 후보자 조회
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('id, name, email, phone, source, metadata')
      .eq('id', id)
      .single()

    if (candidateError || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // 2. adam 추천이 아니면 에러
    if (candidate.source !== 'adam') {
      return NextResponse.json({ 
        error: 'Adam 추천 후보자만 동기화할 수 있습니다.' 
      }, { status: 400 })
    }

    // 3. adam_analysis_id 확인
    const adamAnalysisId = candidate.metadata?.adam_analysis_id
    if (!adamAnalysisId) {
      return NextResponse.json({ 
        error: 'Adam 분석 ID가 없습니다.' 
      }, { status: 400 })
    }

    // 4. Adam API 호출
    const adamApiUrl = process.env.ADAM_API_URL || 'https://adam.jobizic.com'
    const adamApiKey = process.env.EVE_TO_ADAM_API_KEY

    if (!adamApiKey) {
      console.error('[sync-from-adam] EVE_TO_ADAM_API_KEY not set')
      return NextResponse.json({ 
        error: 'API Key가 설정되지 않았습니다.' 
      }, { status: 500 })
    }

    const adamResponse = await fetch(`${adamApiUrl}/api/analysis/${adamAnalysisId}`, {
      headers: {
        'X-API-Key': adamApiKey
      }
    })

    if (!adamResponse.ok) {
      const errorData = await adamResponse.json().catch(() => ({}))
      console.error('[sync-from-adam] Adam API error:', errorData)
      return NextResponse.json({ 
        error: 'Adam에서 분석 결과를 가져올 수 없습니다.' 
      }, { status: 500 })
    }

    const adamData = await adamResponse.json()
    const contactInfo = adamData.analysis?.contact_info

    if (!contactInfo || (!contactInfo.email && !contactInfo.phone)) {
      return NextResponse.json({ 
        error: 'Adam 분석 결과에 연락처 정보가 없습니다.' 
      }, { status: 404 })
    }

    // 5. Eve DB 업데이트
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (contactInfo.email) {
      updateData.email = contactInfo.email
    }

    if (contactInfo.phone) {
      updateData.phone = contactInfo.phone
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('candidates')
      .update(updateData)
      .eq('id', id)
      .select('id, name, email, phone')
      .single()

    if (updateError) {
      console.error('[sync-from-adam] Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '연락처 정보를 가져왔습니다.',
      candidate: updated
    })

  } catch (e: any) {
    console.error('[sync-from-adam] Error:', e)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { data, error } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[api/candidates/[id] GET]', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()

    // 후보자 업데이트
    const { error } = await supabaseAdmin
      .from('candidates')
      .update(body)
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 🎯 비즈니스 로직: 후보자 상태에 따라 JD 상태 자동 변경
    if (body.status) {
      try {
        // 해당 후보자가 연결된 JD 찾기
        const { data: pipelines } = await supabaseAdmin
          .from('pipeline')
          .select('jd_id')
          .eq('candidate_id', id)
          .eq('is_active', true)

        if (pipelines && pipelines.length > 0) {
          const jdIds = pipelines.map(p => p.jd_id)

          // 서류검토 → JD 활성
          if (body.status === '서류검토') {
            await supabaseAdmin
              .from('job_descriptions')
              .update({ status: '활성' })
              .in('id', jdIds)
            console.log('[후보자 상태 변경] 서류검토 → JD 활성화:', jdIds)
          }

          // 합격 → JD 마감
          if (body.status === '합격') {
            await supabaseAdmin
              .from('job_descriptions')
              .update({ status: '마감' })
              .in('id', jdIds)
            console.log('[후보자 상태 변경] 합격 → JD 마감:', jdIds)
          }
        }
      } catch (jdError) {
        console.error('[JD 상태 자동 변경 실패]', jdError)
        // JD 업데이트 실패해도 후보자 업데이트는 성공으로 처리
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/candidates/[id] PATCH]', e)
    return NextResponse.json({ error: '업데이트 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { error } = await supabaseAdmin
      .from('candidates')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/candidates/[id] DELETE]', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logCandidateAccess } from '@/lib/log-candidate-access'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { data, error } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 🔍 Adam 접근 로그 기록
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // 디버깅
    console.log('[candidate GET] User email:', user?.email)
    console.log('[candidate GET] Candidate email:', data?.email)
    console.log('[candidate GET] Candidate data:', { id: data?.id, name: data?.name, email: data?.email })

    if (user?.email && data?.email) {
      console.log('[candidate GET] Logging access to Adam...')
      logCandidateAccess({
        headhunterEmail: user.email,
        candidateEmail: data.email,
        action: 'view',
        details: {
          candidateName: data.name,
          candidateId: data.id,
          timestamp: new Date().toISOString()
        }
      }).catch(err => {
        // 로그 실패해도 메인 기능은 계속
        console.error('[candidate view] Log failed:', err)
      })
    } else {
      console.log('[candidate GET] Skipping log: user.email=', user?.email, 'data.email=', data?.email)
    }

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

    console.log('[DELETE candidate] 시작:', id)

    // 1. 먼저 job_requests에서 이 candidate를 참조하는 것들을 정리
    const { error: jobRequestError } = await supabaseAdmin
      .from('job_requests')
      .update({ candidate_id: null, status: 'pending' })
      .eq('candidate_id', id)

    if (jobRequestError) {
      console.error('[DELETE candidate] job_requests 업데이트 실패:', jobRequestError)
      // 치명적이지 않으므로 계속 진행
    } else {
      console.log('[DELETE candidate] job_requests 정리 완료')
    }

    // 2. 후보자 삭제
    const { error } = await supabaseAdmin
      .from('candidates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[DELETE candidate] 삭제 실패:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[DELETE candidate] ✅ 삭제 완료:', id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/candidates/[id] DELETE]', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

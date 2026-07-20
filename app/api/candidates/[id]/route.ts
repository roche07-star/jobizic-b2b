import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logCandidateAccess } from '@/lib/log-candidate-access'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

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

    if (!user?.email) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 후보자 조회
    const { data, error } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 권한 체크
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('email', user.email)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // Admin: 모든 후보자 접근 가능
    if (userProfile.role !== 'admin') {
      // Owner/Manager: 본인 + Operator 후보자
      if (userProfile.role === 'owner' || userProfile.role === 'manager') {
        // 본인 후보자인지 확인
        const isOwnCandidate = data.created_by === user.email

        if (!isOwnCandidate) {
          // Operator 후보자인지 확인
          const { data: candidateOwner } = await supabaseAdmin
            .from('profiles')
            .select('role, organization_id')
            .eq('email', data.created_by)
            .single()

          const isOperatorCandidate =
            candidateOwner?.role === 'operator' &&
            candidateOwner?.organization_id === userProfile.organization_id

          if (!isOperatorCandidate) {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
          }
        }
      }
      // Headhunter/Operator: 본인 후보자만
      else if (userProfile.role === 'headhunter' || userProfile.role === 'operator') {
        if (data.created_by !== user.email) {
          return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
        }
      }
    }

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

    // 권한 체크
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

    if (!user?.email) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 후보자 조회
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: '후보자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 권한 체크
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('email', user.email)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // Admin: 모든 후보자 수정 가능
    if (userProfile.role !== 'admin') {
      // Owner/Manager: 본인 + Operator 후보자
      if (userProfile.role === 'owner' || userProfile.role === 'manager') {
        const isOwnCandidate = candidate.created_by === user.email

        if (!isOwnCandidate) {
          // Operator 후보자인지 확인
          const { data: candidateOwner } = await supabaseAdmin
            .from('profiles')
            .select('role, organization_id')
            .eq('email', candidate.created_by)
            .single()

          const isOperatorCandidate =
            candidateOwner?.role === 'operator' &&
            candidateOwner?.organization_id === userProfile.organization_id

          if (!isOperatorCandidate) {
            return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
          }
        }
      }
      // Headhunter/Operator: 본인 후보자만
      else if (userProfile.role === 'headhunter' || userProfile.role === 'operator') {
        if (candidate.created_by !== user.email) {
          return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
        }
      }
    }

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

    // 권한 체크
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

    if (!user?.email) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 후보자 조회
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: '후보자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 권한 체크
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('email', user.email)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // Admin: 모든 후보자 삭제 가능
    if (userProfile.role !== 'admin') {
      // Owner/Manager: 본인 + Operator 후보자
      if (userProfile.role === 'owner' || userProfile.role === 'manager') {
        const isOwnCandidate = candidate.created_by === user.email

        if (!isOwnCandidate) {
          // Operator 후보자인지 확인
          const { data: candidateOwner } = await supabaseAdmin
            .from('profiles')
            .select('role, organization_id')
            .eq('email', candidate.created_by)
            .single()

          const isOperatorCandidate =
            candidateOwner?.role === 'operator' &&
            candidateOwner?.organization_id === userProfile.organization_id

          if (!isOperatorCandidate) {
            return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
          }
        }
      }
      // Headhunter/Operator: 본인 후보자만
      else if (userProfile.role === 'headhunter' || userProfile.role === 'operator') {
        if (candidate.created_by !== user.email) {
          return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
        }
      }
    }

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

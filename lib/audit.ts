/**
 * Eve 자체 접근 로그 기록
 *
 * 헤드헌터가 후보자 정보를 조회할 때 Eve DB에 접근 로그를 자동으로 기록합니다.
 * 개인정보보호법 제26조에 따른 수탁자 모니터링 의무 준수
 */

import { supabase } from '@/lib/supabase'

interface AuditLogParams {
  actor_email: string
  target_email?: string
  target_id?: string
  action: 'candidate_view' | 'candidate_export' | 'candidate_share' | 'candidate_contact' | 'jd_view'
  details?: Record<string, any>
}

/**
 * 접근 로그 기록
 *
 * @param params - 로그 파라미터
 * @returns Promise<boolean> - 성공 여부
 *
 * @example
 * ```typescript
 * await logAccess({
 *   actor_email: 'recruiter@company.com',
 *   target_email: 'candidate@example.com',
 *   target_id: 'candidate-id-123',
 *   action: 'candidate_view',
 *   details: { page: 'candidate_detail' }
 * })
 * ```
 */
export async function logAccess(params: AuditLogParams): Promise<boolean> {
  try {
    const { error } = await supabase().from('audit_logs').insert({
      action: params.action,
      actor_email: params.actor_email,
      target_email: params.target_email || null,
      target_id: params.target_id || null,
      details: params.details || {},
      ip_address: null, // 브라우저에서는 IP 가져올 수 없음
      user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
    })

    if (error) {
      console.error('[audit] Failed to log:', error)
      return false
    }

    console.log('[audit] Logged:', params.action, params.target_email || params.target_id)
    return true
  } catch (error) {
    console.error('[audit] Error:', error)
    // 로그 실패해도 사용자는 정상적으로 정보를 볼 수 있어야 함
    return false
  }
}

/**
 * 후보자 조회 로그
 */
export async function logCandidateView(
  headhunterEmail: string,
  candidate: { id: string; email?: string | null; name: string }
): Promise<boolean> {
  console.log('[audit.logCandidateView] Called with:', {
    headhunterEmail,
    candidateId: candidate.id,
    candidateName: candidate.name
  })

  return logAccess({
    actor_email: headhunterEmail,
    target_email: candidate.email || undefined,
    target_id: candidate.id,
    action: 'candidate_view',
    details: {
      candidate_name: candidate.name,
      page: 'candidate_detail_modal',
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * 이력서 다운로드 로그
 */
export async function logCandidateExport(
  headhunterEmail: string,
  candidateId: string,
  candidateEmail: string | null,
  exportType: string
): Promise<boolean> {
  return logAccess({
    actor_email: headhunterEmail,
    target_email: candidateEmail || undefined,
    target_id: candidateId,
    action: 'candidate_export',
    details: {
      export_type: exportType,
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * 후보자 공유 로그
 */
export async function logCandidateShare(
  headhunterEmail: string,
  candidateId: string,
  candidateEmail: string | null,
  sharedWith: string
): Promise<boolean> {
  return logAccess({
    actor_email: headhunterEmail,
    target_email: candidateEmail || undefined,
    target_id: candidateId,
    action: 'candidate_share',
    details: {
      shared_with: sharedWith,
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * 후보자 연락처 확인 로그
 */
export async function logCandidateContact(
  headhunterEmail: string,
  candidateId: string,
  candidateEmail: string | null,
  contactType: string
): Promise<boolean> {
  return logAccess({
    actor_email: headhunterEmail,
    target_email: candidateEmail || undefined,
    target_id: candidateId,
    action: 'candidate_contact',
    details: {
      contact_type: contactType,
      timestamp: new Date().toISOString(),
    },
  })
}

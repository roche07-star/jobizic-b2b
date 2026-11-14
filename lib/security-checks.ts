import { reportSecurityEvent, extractIpFromHeaders } from '@/lib/security-reporter'

const SQL_INJECTION_RE = /('|--|;|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bunion\b|\bexec\b|\bpg_sleep\b|\bwaitfor\b|\bsleep\b)/i
const XSS_RE           = /<[^>]*>|javascript\s*:|on\w+\s*=/i

export interface SecurityCheckResult {
  blocked: boolean
  event_type?: string
  rule_id?: string
  detail?: Record<string, unknown>
}

/**
 * 텍스트 필드에 대해 SQL 인젝션 / XSS / 버퍼 오버플로우를 순서대로 검사합니다.
 * 위반 감지 시 Security Center에 이벤트를 보고하고 blocked: true를 반환합니다.
 */
export function runSecurityChecks(
  fields: Record<string, unknown>,
  fieldMaxLen: Record<string, number>,
  req: { headers: Headers | { get: (k: string) => string | null } },
  requestPath: string,
): SecurityCheckResult {
  const ip = extractIpFromHeaders(req.headers)

  // 1. 버퍼 오버플로우
  for (const [field, max] of Object.entries(fieldMaxLen)) {
    const val = fields[field]
    if (val && typeof val === 'string' && val.length > max) {
      reportSecurityEvent({
        event_type: 'buffer_overflow',
        severity: 'HIGH',
        source_ip: ip,
        rule_id: 'SEC-016',
        request_path: requestPath,
        http_method: 'POST',
        status_code: 400,
        event_detail: { field, length: val.length, max },
      })
      return { blocked: true, event_type: 'buffer_overflow', rule_id: 'SEC-016', detail: { field, max } }
    }
  }

  // 2. SQL 인젝션
  for (const [field, val] of Object.entries(fields)) {
    if (typeof val === 'string' && SQL_INJECTION_RE.test(val)) {
      reportSecurityEvent({
        event_type: 'sql_injection',
        severity: 'HIGH',
        source_ip: ip,
        rule_id: 'SEC-003',
        request_path: requestPath,
        http_method: 'POST',
        status_code: 400,
        event_detail: { field, value_preview: val.slice(0, 100) },
      })
      return { blocked: true, event_type: 'sql_injection', rule_id: 'SEC-003', detail: { field } }
    }
  }

  // 3. XSS
  for (const [field, val] of Object.entries(fields)) {
    if (typeof val === 'string' && XSS_RE.test(val)) {
      reportSecurityEvent({
        event_type: 'xss_attempt',
        severity: 'HIGH',
        source_ip: ip,
        rule_id: 'SEC-004',
        request_path: requestPath,
        http_method: 'POST',
        status_code: 400,
        event_detail: { field, value_preview: val.slice(0, 100) },
      })
      return { blocked: true, event_type: 'xss_attempt', rule_id: 'SEC-004', detail: { field } }
    }
  }

  return { blocked: false }
}

// Security Center로 이벤트를 비동기 전송 (fire-and-forget)
// 전송 실패가 서비스에 영향을 주지 않도록 설계

export interface SecurityEventPayload {
  event_type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  source_ip?: string
  user_id?: string
  http_method?: string
  request_path?: string
  status_code?: number
  rule_id?: string
  event_detail?: Record<string, unknown>
}

export function reportSecurityEvent(event: SecurityEventPayload): void {
  const url = process.env.SECURITY_CENTER_URL
  const secret = process.env.SECURITY_API_SECRET
  if (!url || !secret) return

  fetch(`${url}/api/security/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-security-api-key': secret,
    },
    body: JSON.stringify({
      ...event,
      source_project: 'jobizic_b2b',
    }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {})
}

export function extractIpFromHeaders(headers: Headers | { get: (key: string) => string | null }): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

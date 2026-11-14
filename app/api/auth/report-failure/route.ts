import { NextRequest, NextResponse } from 'next/server'
import { reportSecurityEvent, extractIpFromHeaders } from '@/lib/security-reporter'

export async function POST(req: NextRequest) {
  try {
    const { email, reason } = await req.json()
    const ip = extractIpFromHeaders(req.headers)

    reportSecurityEvent({
      event_type: 'auth_failed',
      severity: 'HIGH',
      source_ip: ip,
      rule_id: 'SEC-001',
      request_path: '/login',
      http_method: 'POST',
      status_code: 401,
      event_detail: { reason: reason ?? 'invalid_credentials', email },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}

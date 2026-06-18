/**
 * 🔒 보안 이벤트 로깅
 *
 * 보안 관련 이벤트를 기록하고 이상 행위를 감지
 */

import { supabaseAdmin } from './supabase-admin'

export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_change'
  | 'password_reset'
  | 'account_locked'
  | 'api_key_accessed'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'suspicious_activity'
  | 'data_export'
  | 'data_deletion'
  | 'permission_denied'
  | 'encryption_error'
  | 'decryption_error'

export interface SecurityEvent {
  type: SecurityEventType
  userId?: string
  userEmail?: string
  ip?: string
  userAgent?: string
  resource?: string
  action?: string
  success: boolean
  errorMessage?: string
  metadata?: Record<string, any>
}

/**
 * 보안 이벤트 로깅
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    const logEntry = {
      event_type: event.type,
      user_id: event.userId || null,
      user_email: event.userEmail || null,
      ip_address: event.ip || null,
      user_agent: event.userAgent || null,
      resource: event.resource || null,
      action: event.action || null,
      success: event.success,
      error_message: event.errorMessage || null,
      metadata: event.metadata || null,
      created_at: new Date().toISOString(),
    }

    // 콘솔 로그 (개발 환경)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Security Event]', {
        type: event.type,
        success: event.success,
        user: event.userEmail,
        resource: event.resource,
      })
    }

    // Database 저장 (security_logs 테이블)
    // 테이블이 없으면 에러 발생, 하지만 중요한 동작을 막지 않음
    try {
      await supabaseAdmin.from('security_logs').insert(logEntry)
    } catch (dbError) {
      // DB 저장 실패해도 메인 로직은 계속 진행
      console.error('[Security Logger] DB insert failed:', dbError)
    }

    // 프로덕션: 외부 로깅 서비스 연동 (Sentry, DataDog 등)
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
      // TODO: Sentry 연동
    }
  } catch (error) {
    console.error('[Security Logger] Error:', error)
    // 로깅 실패해도 에러를 던지지 않음 (메인 로직 방해 X)
  }
}

/**
 * 이상 행위 감지
 *
 * 짧은 시간에 많은 실패 로그인 시도 등
 */
export async function detectAnomalies(
  userEmail: string,
  eventType: SecurityEventType,
  timeWindowMinutes: number = 10
): Promise<{
  isAnomalous: boolean
  count: number
  threshold: number
}> {
  try {
    const threshold = getThreshold(eventType)
    const since = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('security_logs')
      .select('id')
      .eq('user_email', userEmail)
      .eq('event_type', eventType)
      .eq('success', false)
      .gte('created_at', since)

    if (error) {
      console.error('[Anomaly Detection] Error:', error)
      return { isAnomalous: false, count: 0, threshold }
    }

    const count = data?.length || 0
    const isAnomalous = count >= threshold

    if (isAnomalous) {
      console.warn(`[Anomaly Detected] ${userEmail} - ${eventType}: ${count} attempts in ${timeWindowMinutes}m`)

      // 계정 잠금 또는 알림
      await logSecurityEvent({
        type: 'suspicious_activity',
        userEmail,
        success: true,
        metadata: {
          eventType,
          count,
          timeWindowMinutes,
        },
      })
    }

    return { isAnomalous, count, threshold }
  } catch (error) {
    console.error('[Anomaly Detection] Error:', error)
    return { isAnomalous: false, count: 0, threshold: 0 }
  }
}

/**
 * 이벤트 타입별 임계값
 */
function getThreshold(eventType: SecurityEventType): number {
  const thresholds: Record<SecurityEventType, number> = {
    login_failed: 5, // 5회 실패 로그인
    rate_limit_exceeded: 10,
    unauthorized_access: 3,
    permission_denied: 10,
    encryption_error: 5,
    decryption_error: 5,
    // 나머지는 기록만
    login_success: 100,
    logout: 100,
    password_change: 100,
    password_reset: 100,
    account_locked: 100,
    api_key_accessed: 100,
    suspicious_activity: 100,
    data_export: 100,
    data_deletion: 100,
  }

  return thresholds[eventType] || 10
}

/**
 * 보안 로그 조회 (관리자용)
 */
export async function getSecurityLogs(filters: {
  userId?: string
  eventType?: SecurityEventType
  startDate?: string
  endDate?: string
  limit?: number
}) {
  let query = supabaseAdmin
    .from('security_logs')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.userId) query = query.eq('user_id', filters.userId)
  if (filters.eventType) query = query.eq('event_type', filters.eventType)
  if (filters.startDate) query = query.gte('created_at', filters.startDate)
  if (filters.endDate) query = query.lte('created_at', filters.endDate)

  const limit = filters.limit || 100
  query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('[Security Logs] Query error:', error)
    return []
  }

  return data
}

/**
 * 보안 대시보드 통계
 */
export async function getSecurityStats(days: number = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    const { data, error } = await supabaseAdmin
      .from('security_logs')
      .select('event_type, success')
      .gte('created_at', since)

    if (error) {
      console.error('[Security Stats] Error:', error)
      return null
    }

    // 이벤트 타입별 통계
    const stats: Record<string, { total: number; success: number; failed: number }> = {}

    data?.forEach((log: any) => {
      const type = log.event_type
      if (!stats[type]) {
        stats[type] = { total: 0, success: 0, failed: 0 }
      }
      stats[type].total++
      if (log.success) {
        stats[type].success++
      } else {
        stats[type].failed++
      }
    })

    return {
      period: `${days} days`,
      stats,
      totalEvents: data?.length || 0,
    }
  } catch (error) {
    console.error('[Security Stats] Error:', error)
    return null
  }
}

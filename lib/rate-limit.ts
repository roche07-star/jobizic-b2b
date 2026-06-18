/**
 * 🔒 Rate Limiting
 *
 * API 남용 방지를 위한 요청 제한
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export interface RateLimitConfig {
  /**
   * 시간 윈도우 (ms)
   * @default 60000 (1분)
   */
  windowMs?: number

  /**
   * 윈도우 당 최대 요청 수
   * @default 10
   */
  max?: number
}

/**
 * Rate Limit 체크
 *
 * @param identifier - 고유 식별자 (IP, user ID 등)
 * @param config - Rate Limit 설정
 * @returns { allowed, remaining, resetTime }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): {
  allowed: boolean
  remaining: number
  resetTime: number
} {
  const { windowMs = 60000, max = 10 } = config
  const now = Date.now()
  const key = `ratelimit:${identifier}`

  // 기존 레코드 확인
  const record = store[key]

  // 레코드 없거나 만료됨
  if (!record || now > record.resetTime) {
    store[key] = {
      count: 1,
      resetTime: now + windowMs
    }
    return {
      allowed: true,
      remaining: max - 1,
      resetTime: now + windowMs
    }
  }

  // 레코드 있음
  if (record.count < max) {
    record.count++
    return {
      allowed: true,
      remaining: max - record.count,
      resetTime: record.resetTime
    }
  }

  // 제한 초과
  return {
    allowed: false,
    remaining: 0,
    resetTime: record.resetTime
  }
}

/**
 * Rate Limit 초기화 (테스트용)
 */
export function resetRateLimit(identifier: string) {
  const key = `ratelimit:${identifier}`
  delete store[key]
}

/**
 * Rate Limit 미들웨어
 *
 * @example
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const ip = req.headers.get('x-forwarded-for') || 'unknown'
 *   const { allowed, remaining, resetTime } = checkRateLimit(ip, { max: 5, windowMs: 60000 })
 *
 *   if (!allowed) {
 *     return NextResponse.json(
 *       { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
 *       {
 *         status: 429,
 *         headers: {
 *           'X-RateLimit-Limit': '5',
 *           'X-RateLimit-Remaining': '0',
 *           'X-RateLimit-Reset': new Date(resetTime).toISOString()
 *         }
 *       }
 *     )
 *   }
 *
 *   // ... 정상 처리
 * }
 * ```
 */

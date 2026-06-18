import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // 🔒 보안 헤더 추가
  const headers = response.headers

  // CSP: XSS 방지
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com https://*.supabase.co;"
  )

  // X-Frame-Options: 클릭재킹 방지
  headers.set('X-Frame-Options', 'DENY')

  // X-Content-Type-Options: MIME 스니핑 방지
  headers.set('X-Content-Type-Options', 'nosniff')

  // Referrer-Policy: 리퍼러 정보 최소화
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions-Policy: 불필요한 기능 비활성화
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )

  // HTTPS 강제 (프로덕션)
  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

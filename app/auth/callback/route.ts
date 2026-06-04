import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  console.log('[AUTH CALLBACK]', { code: !!code, error, errorDescription })

  // 에러가 있으면 로그인 페이지로
  if (error) {
    console.error('[AUTH CALLBACK] Error:', error, errorDescription)
    return NextResponse.redirect(
      `${requestUrl.origin}/?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  // code가 있으면 세션 교환
  if (code) {
    const response = NextResponse.redirect(`${requestUrl.origin}/auth/set-password`)

    // 쿠키를 사용하는 Supabase 클라이언트 생성
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[AUTH CALLBACK] Exchange error:', exchangeError)
      return NextResponse.redirect(
        `${requestUrl.origin}/?error=${encodeURIComponent(exchangeError.message)}`
      )
    }

    console.log('[AUTH CALLBACK] Session created successfully and stored in cookies')

    // 비밀번호 설정 페이지로 리다이렉트 (쿠키에 세션 포함)
    return response
  }

  // code도 error도 없으면 홈으로
  console.warn('[AUTH CALLBACK] No code or error, redirecting to home')
  return NextResponse.redirect(requestUrl.origin)
}

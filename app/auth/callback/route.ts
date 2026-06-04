import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[AUTH CALLBACK] Exchange error:', exchangeError)
      return NextResponse.redirect(
        `${requestUrl.origin}/?error=${encodeURIComponent(exchangeError.message)}`
      )
    }

    console.log('[AUTH CALLBACK] Session created successfully')

    // 대시보드로 리다이렉트
    return NextResponse.redirect(`${requestUrl.origin}/`)
  }

  // code도 error도 없으면 홈으로
  console.warn('[AUTH CALLBACK] No code or error, redirecting to home')
  return NextResponse.redirect(requestUrl.origin)
}

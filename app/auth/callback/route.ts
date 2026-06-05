import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const type = requestUrl.searchParams.get('type')

  console.log('[AUTH CALLBACK]', { code: !!code, type, error, errorDescription })

  // 에러가 있으면 로그인 페이지로
  if (error) {
    console.error('[AUTH CALLBACK] Error:', error, errorDescription)
    return NextResponse.redirect(
      `${requestUrl.origin}/?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  // code가 있으면 세션 교환
  if (code) {
    // 임시 response 생성 (쿠키 설정용)
    let response = NextResponse.next()

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

    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[AUTH CALLBACK] Exchange error:', exchangeError)
      return NextResponse.redirect(
        `${requestUrl.origin}/?error=${encodeURIComponent(exchangeError.message)}`
      )
    }

    console.log('[AUTH CALLBACK] Session created successfully and stored in cookies')

    // 사용자 정보 확인
    const user = sessionData?.user

    // 초대된 사용자 판단: invited_at이 있고 첫 로그인인 경우
    const isFirstLogin = !user?.last_sign_in_at
    const wasInvited = !!user?.invited_at
    const isInvitedUser = wasInvited && isFirstLogin

    console.log('[AUTH CALLBACK] User info:', {
      email: user?.email,
      type,
      invited_at: user?.invited_at,
      last_sign_in_at: user?.last_sign_in_at,
      isFirstLogin,
      wasInvited,
      isInvitedUser,
      user_metadata: user?.user_metadata
    })

    // type에 따라 리다이렉트 경로 결정
    let redirectPath: string

    if (type === 'recovery') {
      // 비밀번호 재설정 플로우
      console.log('[AUTH CALLBACK] Password recovery flow -> /auth/reset-password')
      redirectPath = `${requestUrl.origin}/auth/reset-password`
    } else if (type === 'invite' || isInvitedUser) {
      // 초대받은 사용자 플로우
      console.log('[AUTH CALLBACK] Invited user flow -> /auth/set-password')
      redirectPath = `${requestUrl.origin}/auth/set-password`
    } else {
      // 기타 (일반 로그인 등) - 홈으로
      console.log('[AUTH CALLBACK] Regular login -> home')
      redirectPath = `${requestUrl.origin}/`
    }

    // 최종 response 생성 (쿠키 복사)
    const finalResponse = NextResponse.redirect(redirectPath)

    // 쿠키 복사
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie)
    })

    return finalResponse
  }

  // code도 error도 없으면 홈으로
  console.warn('[AUTH CALLBACK] No code or error, redirecting to home')
  return NextResponse.redirect(requestUrl.origin)
}

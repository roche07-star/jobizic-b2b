import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
      `${requestUrl.origin}/?error=${encodeURIComponent(errorDescription || error || 'Unknown error')}`
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

    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code!)

    if (exchangeError) {
      console.error('[AUTH CALLBACK] Exchange error:', exchangeError)
      return NextResponse.redirect(
        `${requestUrl.origin}/?error=${encodeURIComponent(exchangeError?.message || 'Authentication error')}`
      )
    }

    console.log('[AUTH CALLBACK] Session created successfully and stored in cookies')

    // 사용자 정보 확인
    const user = sessionData?.user
    if (!user) {
      console.error('[AUTH CALLBACK] No user in session')
      return NextResponse.redirect(`${requestUrl.origin}/`)
    }

    // profiles 테이블에서 password_set 확인 (Admin으로 RLS 우회)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('password_set')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[AUTH CALLBACK] Profile fetch error:', profileError)
    }

    // 초대된 사용자 판단: password_set이 false이면 비밀번호 설정 필요
    const needsPasswordSetup = profile?.password_set === false
    const isInvitedUser = needsPasswordSetup || type === 'invite'

    console.log('[AUTH CALLBACK] User info:', {
      email: user?.email,
      type,
      invited_at: user?.invited_at,
      last_sign_in_at: user?.last_sign_in_at,
      passwordSet: profile?.password_set,
      needsPasswordSetup,
      isInvitedUser,
      profileError: profileError?.message,
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

  // code가 없어도 세션이 있을 수 있음 (invite flow)
  console.log('[AUTH CALLBACK] No code, checking for existing session...')

  let response = NextResponse.next()
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

  const { data: { session } } = await supabase.auth.getSession()

  const user = session?.user
  if (user) {
    console.log('[AUTH CALLBACK] Session found for:', user.email)

    // profiles 테이블에서 password_set 확인
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('password_set')
      .eq('id', user.id)
      .single()

    const needsPasswordSetup = profile?.password_set === false

    console.log('[AUTH CALLBACK] Session user needs password setup:', needsPasswordSetup)

    if (needsPasswordSetup) {
      const finalResponse = NextResponse.redirect(`${requestUrl.origin}/auth/set-password`)
      response.cookies.getAll().forEach(cookie => {
        finalResponse.cookies.set(cookie)
      })
      return finalResponse
    }
  }

  // 세션도 없으면 홈으로
  console.warn('[AUTH CALLBACK] No code, no session, redirecting to home')
  return NextResponse.redirect(requestUrl.origin)
}

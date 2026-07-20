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

    // 초대받은 사용자인지 확인 (invited_at이 있으면 초대받은 사용자)
    const isInvitedUser = user?.invited_at

    console.log('[AUTH CALLBACK] User info:', {
      email: user?.email,
      type,
      invited_at: user?.invited_at,
      isInvitedUser
    })

    // 초대받은 사용자는 무조건 비밀번호 설정 페이지로
    if (isInvitedUser || type === 'invite') {
      console.log('[AUTH CALLBACK] Redirecting to set-password (invited user)')

      // Profile 업데이트 (user_metadata → profiles 테이블)
      if (user?.id && user?.user_metadata) {
        const { organization_id, full_name, role } = user.user_metadata

        console.log('[AUTH CALLBACK] Updating profile for invited user:', {
          user_id: user.id,
          organization_id,
          full_name,
          role
        })

        try {
          const updateData: any = {}
          if (organization_id) updateData.organization_id = organization_id
          if (full_name) updateData.full_name = full_name
          if (role) updateData.role = role

          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update(updateData)
            .eq('id', user.id)

          if (profileError) {
            console.error('[AUTH CALLBACK] Profile update error:', profileError)
          } else {
            console.log('[AUTH CALLBACK] Profile updated successfully')
          }
        } catch (err) {
          console.error('[AUTH CALLBACK] Profile update exception:', err)
        }
      }

      const finalResponse = NextResponse.redirect(`${requestUrl.origin}/auth/set-password`)
      response.cookies.getAll().forEach(cookie => {
        finalResponse.cookies.set(cookie)
      })
      return finalResponse
    }

    // type에 따라 리다이렉트 경로 결정
    let redirectPath: string

    if (type === 'recovery') {
      console.log('[AUTH CALLBACK] Password recovery flow -> /auth/reset-password')
      redirectPath = `${requestUrl.origin}/auth/reset-password`
    } else {
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

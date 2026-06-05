import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 인증 관련 페이지는 스킵
  if (pathname.startsWith('/auth/') || pathname.startsWith('/api/') || pathname === '/login') {
    return NextResponse.next()
  }

  let response = NextResponse.next()

  // 세션 확인
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
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

  // 로그인되어 있으면 password_set 확인
  if (session?.user) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('password_set')
      .eq('id', session.user.id)
      .single()

    // password_set이 false면 비밀번호 설정 페이지로
    if (profile?.password_set === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/set-password'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

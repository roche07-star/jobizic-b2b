import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (!error) {
      // 성공: 홈으로 리다이렉트
      return NextResponse.redirect(new URL(next, req.url))
    }
  }

  // 실패: 에러 페이지로
  return NextResponse.redirect(new URL('/auth/auth-code-error', req.url))
}

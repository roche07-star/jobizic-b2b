import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// 사용자 비밀번호 초기화 (재설정 이메일 발송)
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: '이메일이 필요합니다.' }, { status: 400 })
    }

    console.log('[RESET PASSWORD] Sending reset email to:', email)

    // 현재 요청의 origin 가져오기
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || process.env.NEXT_PUBLIC_SITE_URL || 'https://jobizic-biz.vercel.app'
    console.log('[RESET PASSWORD] Request origin:', origin)

    // Supabase Auth로 비밀번호 재설정 이메일 발송
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/reset-password`,
    })

    if (error) {
      console.error('[RESET PASSWORD] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[RESET PASSWORD] Email sent successfully to:', email)

    return NextResponse.json({ 
      success: true,
      message: '비밀번호 재설정 이메일이 발송되었습니다.'
    })
  } catch (e: any) {
    console.error('[api/admin/users/reset-password POST]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

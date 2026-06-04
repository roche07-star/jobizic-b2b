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

    // Supabase Auth로 비밀번호 재설정 이메일 발송
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jobizic-biz.vercel.app'}/auth/reset-password`,
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

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

// Admin API - service_role key 사용 (RLS bypass)
export async function GET() {
  try {
    // Profiles 조회 (organizations 조인)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        organizations (
          id,
          name,
          type
        )
      `)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data })
  } catch (e: any) {
    console.error('[admin/users GET]', e)
    return NextResponse.json({ error: e.message || '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 랜덤 임시 비밀번호 생성
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export async function POST(req: NextRequest) {
  try {
    const { email, full_name, role, organization_id } = await req.json()

    if (!email) {
      return NextResponse.json({ error: '이메일은 필수입니다.' }, { status: 400 })
    }

    // 임시 비밀번호 생성
    const tempPassword = generateTempPassword()

    // 사용자 생성 (임시 비밀번호 포함)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: role || 'headhunter',
      },
    })

    if (authError || !authData?.user) {
      return NextResponse.json({ error: authError?.message || '사용자 생성 실패' }, { status: 500 })
    }

    console.log(`[CREATE USER] ${email} with temp password: ${tempPassword}`)

    // Profile 업데이트 (password_set=false로 첫 로그인 시 비밀번호 변경 강제)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        organization_id,
        full_name,
        role: role || 'headhunter',
        password_set: false, // 비밀번호 변경 필요
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
    }

    // 이메일 발송 (API 키가 있을 때만)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
        from: 'JOBIZIC <onboarding@resend.dev>', // 나중에 실제 도메인으로 변경
        to: email,
        subject: 'JOBIZIC 계정이 생성되었습니다',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">안녕하세요!</h2>
            <p>JOBIZIC 계정이 생성되었습니다.</p>

            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">로그인 정보</h3>
              <p><strong>이메일:</strong> ${email}</p>
              <p><strong>임시 비밀번호:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${tempPassword}</code></p>
            </div>

            <p>
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://jobizic-biz.vercel.app'}/login"
                 style="display: inline-block; background: #CDFF00; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                로그인하기
              </a>
            </p>

            <p style="color: #666; font-size: 14px;">
              ⚠️ 첫 로그인 시 비밀번호 변경이 필요합니다.
            </p>
          </div>
        `,
      })
        console.log(`[EMAIL SENT] Welcome email sent to ${email}`)
      } catch (emailError) {
        console.error('[EMAIL ERROR]', emailError)
        // 이메일 발송 실패해도 사용자 생성은 성공으로 처리
      }
    } else {
      console.log('[EMAIL SKIP] RESEND_API_KEY not configured')
    }

    return NextResponse.json({
      id: authData.user.id,
      email: authData.user.email,
      tempPassword: tempPassword,
      message: `✅ 사용자 생성 완료! 환영 이메일이 발송되었습니다.`,
    })
  } catch (e: any) {
    console.error('[admin/users POST]', e)
    return NextResponse.json({ error: e.message || '사용자 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

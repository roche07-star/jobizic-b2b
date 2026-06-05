import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

export async function POST(req: NextRequest) {
  try {
    const { email, full_name, role, organization_id } = await req.json()

    if (!email) {
      return NextResponse.json({ error: '이메일은 필수입니다.' }, { status: 400 })
    }

    const isDev = process.env.DEV_MODE === 'true'
    let authData, authError

    if (isDev) {
      // 개발 모드: 임시 비밀번호로 바로 생성 (이메일 발송 없음)
      const devPassword = process.env.DEV_DEFAULT_PASSWORD || 'test1234'
      const result = await supabaseAdmin.auth.admin.createUser({
        email,
        password: devPassword,
        email_confirm: true,
        user_metadata: {
          full_name,
          role: role || 'headhunter',
        },
      })
      authData = result.data
      authError = result.error
      console.log(`[DEV MODE] User created with password: ${devPassword}`)
    } else {
      // 프로덕션 모드: 이메일 초대 발송
      const result = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name,
          role: role || 'headhunter',
          organization_id,
          needs_password_setup: true, // 비밀번호 설정 필요 플래그
        },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jobizic-biz.vercel.app'}/auth/callback`,
      })
      authData = result.data
      authError = result.error
    }

    if (authError || !authData?.user) {
      return NextResponse.json({ error: authError?.message || '사용자 생성 실패' }, { status: 500 })
    }

    // Profile 업데이트 (트리거로 생성되었으므로 업데이트만)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        organization_id,
        full_name,
        role: role || 'headhunter',
        password_set: isDev ? true : false, // 개발: true, 초대: false
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
    }

    return NextResponse.json({
      id: authData.user.id,
      email: authData.user.email,
      message: isDev ? `사용자 생성 완료 (비밀번호: ${process.env.DEV_DEFAULT_PASSWORD || 'test1234'})` : '초대 이메일이 발송되었습니다.',
      dev_mode: isDev,
    })
  } catch (e: any) {
    console.error('[admin/users POST]', e)
    return NextResponse.json({ error: e.message || '초대 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

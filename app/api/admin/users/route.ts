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

    return NextResponse.json({
      id: authData.user.id,
      email: authData.user.email,
      tempPassword: tempPassword,
      message: `사용자 생성 완료! 임시 비밀번호를 사용자에게 전달하세요.`,
    })
  } catch (e: any) {
    console.error('[admin/users POST]', e)
    return NextResponse.json({ error: e.message || '사용자 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

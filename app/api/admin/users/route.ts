import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Admin API - service_role key 사용 (RLS bypass)
export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get('role')
    const organizationId = req.nextUrl.searchParams.get('organization_id')

    // Profiles 조회 (organizations 조인)
    let q = supabaseAdmin
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

    // Owner는 본인 조직 멤버만 조회
    if (role === 'owner' && organizationId) {
      q = q.eq('organization_id', organizationId)
    }

    const { data, error } = await q

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

    // 이메일 초대 (Supabase가 자동으로 이메일 발송)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name,
        role: role || 'headhunter',
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jobizic-biz.vercel.app'}/auth/callback`,
    })

    if (authError || !authData?.user) {
      return NextResponse.json({ error: authError?.message || '초대 실패' }, { status: 500 })
    }

    console.log(`[INVITE USER] ${email}`)

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
      message: `✅ 초대 이메일이 발송되었습니다!`,
    })
  } catch (e: any) {
    console.error('[admin/users POST]', e)
    return NextResponse.json({ error: e.message || '사용자 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

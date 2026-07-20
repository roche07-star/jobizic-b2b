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
    const { email, full_name, role, organization_id, invite_method, permissions } = await req.json()

    if (!email) {
      return NextResponse.json({ error: '이메일은 필수입니다.' }, { status: 400 })
    }

    // 현재 요청의 origin 가져오기
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || process.env.NEXT_PUBLIC_SITE_URL || 'https://jobizic-biz.vercel.app'
    console.log('[CREATE USER] Request origin:', origin)

    const method = invite_method || 'fixed' // 기본값: 고정 비밀번호
    const defaultPassword = 'jobizic112'
    let authData, authError

    // 기존 사용자가 있으면 삭제 후 재생성/재초대
    try {
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
      const existing = existingUser.users.find(u => u.email === email)

      if (existing) {
        console.log('[CREATE USER] Deleting existing user:', email)
        await supabaseAdmin.auth.admin.deleteUser(existing.id)
      }
    } catch (deleteError) {
      console.log('[CREATE USER] No existing user or delete failed (continuing):', deleteError)
    }

    if (method === 'fixed') {
      // ===== 고정 비밀번호 방식 =====
      console.log('[CREATE USER] Creating user with fixed password:', email)

      const result = await supabaseAdmin.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          full_name,
          role: role || 'headhunter',
          organization_id,
        },
      })
      authData = result.data
      authError = result.error

    } else if (method === 'email') {
      // ===== 초대 이메일 방식 =====
      console.log('[CREATE USER] Sending invite email to:', email)

      const result = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name,
          role: role || 'headhunter',
          organization_id,
        },
        redirectTo: `${origin}/auth/set-password`,
      })
      authData = result.data
      authError = result.error
    }

    if (authError || !authData?.user) {
      return NextResponse.json({ error: authError?.message || '사용자 생성 실패' }, { status: 500 })
    }

    console.log(`[CREATE USER] Success (${method}):`, email)

    // Profile upsert (없으면 생성, 있으면 업데이트)
    const profileData: any = {
      id: authData.user.id,
      email,
      organization_id,
      full_name,
      role: role || 'headhunter',
      password_set: method === 'fixed' ? true : false,
      is_active: true
    }

    // Manager인 경우 permissions 추가
    if (permissions) {
      profileData.permissions = permissions
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
        ignoreDuplicates: false
      })

    if (profileError) {
      console.error('[CREATE USER] Profile upsert error:', profileError)
    }

    return NextResponse.json({
      id: authData.user.id,
      email: authData.user.email,
      method: method,
      password: method === 'fixed' ? defaultPassword : null,
      message: method === 'fixed'
        ? `✅ 사용자가 생성되었습니다!`
        : `✅ 초대 이메일이 발송되었습니다!`,
    })
  } catch (e: any) {
    console.error('[admin/users POST]', e)
    return NextResponse.json({ error: e.message || '사용자 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

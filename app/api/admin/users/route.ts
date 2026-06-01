import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserProfile } from '@/lib/api-helpers'

export async function GET() {
  try {
    // 관리자 권한 체크
    const profile = await getUserProfile()
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

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
    // 관리자 권한 체크
    const profile = await getUserProfile()
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { email, password, full_name, role, organization_id } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호는 필수입니다.' }, { status: 400 })
    }

    // Supabase Auth로 사용자 생성
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 이메일 자동 confirm
      user_metadata: {
        full_name,
        role: role || 'headhunter',
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Profile 업데이트 (트리거로 생성되었으므로 업데이트만)
    if (organization_id) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          organization_id,
          full_name,
          role: role || 'headhunter',
        })
        .eq('id', authData.user.id)

      if (profileError) {
        console.error('Profile update error:', profileError)
      }
    }

    return NextResponse.json({
      id: authData.user.id,
      email: authData.user.email,
    })
  } catch (e: any) {
    console.error('[admin/users POST]', e)
    return NextResponse.json({ error: e.message || '생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

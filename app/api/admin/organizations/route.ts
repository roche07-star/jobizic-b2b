import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Admin API - RLS로 보호됨 (클라이언트에서 admin 체크)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ organizations: data })
  } catch (e: any) {
    console.error('[admin/organizations GET]', e)
    return NextResponse.json({ error: e.message || '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, type, contact_email, contact_phone, admin_email, admin_name } = await req.json()

    if (!name) {
      return NextResponse.json({ error: '조직명은 필수입니다.' }, { status: 400 })
    }

    // 조직 생성
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        type: type || 'headhunter',
        contact_email,
        contact_phone,
        status: 'active',
      })
      .select()
      .single()

    if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 })

    // 관리자 이메일이 있으면 자동 초대
    let invitedUser = null
    if (admin_email) {
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(admin_email, {
          data: {
            full_name: admin_name,
            role: 'headhunter',
            organization_id: organization.id,
          },
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jobizic-biz.vercel.app'}/auth/callback`,
        })

        if (!authError && authData.user) {
          // Profile 업데이트
          await supabaseAdmin
            .from('profiles')
            .update({
              organization_id: organization.id,
              full_name: admin_name,
              role: 'headhunter',
            })
            .eq('id', authData.user.id)

          invitedUser = { email: admin_email, name: admin_name }
        }
      } catch (inviteError) {
        console.error('Admin invite error:', inviteError)
        // 초대 실패해도 조직은 생성됨
      }
    }

    return NextResponse.json({
      organization,
      invited_user: invitedUser,
    })
  } catch (e: any) {
    console.error('[admin/organizations POST]', e)
    return NextResponse.json({ error: e.message || '생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

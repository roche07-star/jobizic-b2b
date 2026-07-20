import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Admin API - RLS로 보호됨 (클라이언트에서 admin 체크)
export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get('role')
    const organizationId = req.nextUrl.searchParams.get('organization_id')

    let q = supabaseAdmin
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    // Owner는 본인 조직만 조회
    if (role === 'owner' && organizationId) {
      q = q.eq('id', organizationId)
    }

    const { data, error } = await q

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 각 조직의 구성원 목록 추가
    const organizationsWithMembers = await Promise.all(
      (data || []).map(async (org) => {
        const { data: members } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, email')
          .eq('organization_id', org.id)
          .eq('is_active', true)
          .order('full_name')

        return {
          ...org,
          members: members || []
        }
      })
    )

    return NextResponse.json({ organizations: organizationsWithMembers })
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

    // 관리자 이메일이 있으면 자동 생성 (고정 비밀번호)
    let invitedUser = null
    let userCreationError = null
    const defaultPassword = 'jobizic112'

    if (admin_email) {
      try {
        console.log('[ORG CREATE] Creating admin with fixed password:', admin_email)

        // 기존 사용자가 있으면 삭제 후 재생성
        try {
          const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
          const existing = existingUser.users.find(u => u.email === admin_email)

          if (existing) {
            console.log('[ORG CREATE] Deleting existing user:', admin_email)
            await supabaseAdmin.auth.admin.deleteUser(existing.id)
          }
        } catch (deleteError) {
          console.log('[ORG CREATE] No existing user or delete failed (continuing):', deleteError)
        }

        // 고정 비밀번호로 사용자 생성
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: admin_email,
          password: defaultPassword,
          email_confirm: true, // 이메일 확인 불필요
          user_metadata: {
            full_name: admin_name,
            role: 'headhunter',
            organization_id: organization.id,
          },
        })

        console.log('[ORG CREATE] User creation result:', {
          success: !authError,
          email: authData?.user?.email,
          error: authError?.message
        })

        if (authError) {
          console.error('[ORG CREATE] Auth error:', authError)
          console.error('[ORG CREATE] Full error details:', JSON.stringify(authError, null, 2))
          userCreationError = authError.message || '사용자 생성 실패'
          // 에러를 throw 하지 않고 계속 진행 (조직은 생성됨)
          console.warn('[ORG CREATE] User creation failed but organization was created')
        }

        if (authData?.user) {
          // Profile upsert (없으면 생성, 있으면 업데이트)
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: authData.user.id,
              email: admin_email,
              organization_id: organization.id,
              full_name: admin_name,
              role: 'headhunter',
              password_set: true, // 고정 비밀번호로 생성되었으므로 true
              is_active: true
            }, {
              onConflict: 'id',
              ignoreDuplicates: false
            })

          if (profileError) {
            console.error('[ORG CREATE] Profile upsert error:', profileError)
          }

          invitedUser = {
            email: admin_email,
            name: admin_name,
            password: defaultPassword // 화면에 표시할 비밀번호
          }
          console.log('[ORG CREATE] Admin created successfully:', invitedUser)
        }
      } catch (inviteError: any) {
        console.error('[ORG CREATE] Admin creation error:', inviteError)
        // 사용자 생성 실패해도 조직은 생성됨
      }
    }

    return NextResponse.json({
      organization,
      invited_user: invitedUser,
      user_creation_error: userCreationError,
    })
  } catch (e: any) {
    console.error('[admin/organizations POST]', e)
    return NextResponse.json({ error: e.message || '생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

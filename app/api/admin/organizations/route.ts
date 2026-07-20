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
    const { name, type, contact_email, contact_phone, admin_email, admin_name, invite_method } = await req.json()

    if (!name) {
      return NextResponse.json({ error: '조직명은 필수입니다.' }, { status: 400 })
    }

    // 현재 요청의 origin 가져오기 (biz.jobizic.com 또는 vercel.app)
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || process.env.NEXT_PUBLIC_SITE_URL || 'https://jobizic-biz.vercel.app'
    console.log('[ORG CREATE] Request origin:', origin)

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

    // 관리자 이메일이 있으면 자동 생성
    let invitedUser = null
    let userCreationError = null
    const defaultPassword = 'jobizic112'
    const method = invite_method || 'fixed' // 기본값: 고정 비밀번호

    if (admin_email) {
      try {
        let authData, authError

        if (method === 'fixed') {
          // ===== 고정 비밀번호 방식 =====
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
          const result = await supabaseAdmin.auth.admin.createUser({
            email: admin_email,
            password: defaultPassword,
            email_confirm: true, // 이메일 확인 불필요
            user_metadata: {
              full_name: admin_name,
              role: 'headhunter',
              organization_id: organization.id,
            },
          })
          authData = result.data
          authError = result.error

        } else if (method === 'email') {
          // ===== 초대 이메일 방식 =====
          console.log('[ORG CREATE] Sending invite email to:', admin_email)

          // 기존 사용자가 있으면 삭제 후 재초대
          try {
            const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
            const existing = existingUser.users.find(u => u.email === admin_email)

            if (existing) {
              console.log('[ORG CREATE] Deleting existing user for re-invite:', admin_email)
              await supabaseAdmin.auth.admin.deleteUser(existing.id)
            }
          } catch (deleteError) {
            console.log('[ORG CREATE] No existing user or delete failed (continuing):', deleteError)
          }

          const result = await supabaseAdmin.auth.admin.inviteUserByEmail(admin_email, {
            data: {
              full_name: admin_name,
              role: 'headhunter',
              organization_id: organization.id,
            },
            redirectTo: `${origin}/auth/callback`,
          })
          authData = result.data
          authError = result.error
        }

        console.log('[ORG CREATE] User creation result:', {
          method,
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
              password_set: method === 'fixed' ? true : false, // 고정 비밀번호: true, 초대 이메일: false
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
            password: method === 'fixed' ? defaultPassword : null, // 고정 비밀번호만 표시
            method: method
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

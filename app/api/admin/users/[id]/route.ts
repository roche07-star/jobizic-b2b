import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// 사용자 수정
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await req.json()

    // profiles 테이블 업데이트
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: body.full_name,
        role: body.role,
        organization_id: body.organization_id,
        is_active: body.is_active,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ user: data })
  } catch (e: any) {
    console.error('[admin/users/[id] PATCH]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// 사용자 삭제
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    console.log('[DELETE USER] Starting deletion for user ID:', id)

    // 1. 먼저 사용자 정보 가져오기 (email 필요)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', id)
      .single()

    if (profileError || !profile) {
      console.error('[DELETE USER] Profile not found:', profileError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userEmail = profile.email
    console.log('[DELETE USER] User email:', userEmail)

    // 2. 관련 데이터 삭제 (created_by로 참조하는 모든 데이터)
    console.log('[DELETE USER] Deleting related data...')

    // candidates 삭제
    const { error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .delete()
      .eq('created_by', userEmail)

    if (candidatesError) {
      console.error('[DELETE USER] Error deleting candidates:', candidatesError)
    }

    // job_descriptions 삭제
    const { error: jdError } = await supabaseAdmin
      .from('job_descriptions')
      .delete()
      .eq('created_by', userEmail)

    if (jdError) {
      console.error('[DELETE USER] Error deleting JDs:', jdError)
    }

    // pipeline 삭제
    const { error: pipelineError } = await supabaseAdmin
      .from('pipeline')
      .delete()
      .eq('created_by', userEmail)

    if (pipelineError) {
      console.error('[DELETE USER] Error deleting pipeline:', pipelineError)
    }

    console.log('[DELETE USER] Related data deleted')

    // 3. profiles 삭제
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id)

    if (deleteProfileError) {
      console.error('[DELETE USER] Error deleting profile:', deleteProfileError)
      return NextResponse.json({ error: deleteProfileError.message }, { status: 500 })
    }

    console.log('[DELETE USER] Profile deleted')

    // 4. Supabase Auth에서 사용자 삭제
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) {
      console.error('[DELETE USER] Error deleting auth user:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    console.log('[DELETE USER] Auth user deleted successfully')

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[admin/users/[id] DELETE]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

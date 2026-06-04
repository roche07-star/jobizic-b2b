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

    // Supabase Auth에서 사용자 삭제 (profiles는 CASCADE로 자동 삭제)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[admin/users/[id] DELETE]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

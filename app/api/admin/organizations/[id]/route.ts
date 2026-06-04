import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// 조직 정보 수정
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await req.json()

    // status만 있으면 상태 변경 (기존 기능 유지)
    if (body.status && Object.keys(body).length === 1) {
      if (!['active', 'inactive'].includes(body.status)) {
        return NextResponse.json({ error: '유효한 상태를 선택하세요.' }, { status: 400 })
      }
      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({ status: body.status })
        .eq('id', id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // 전체 정보 수정
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.type !== undefined) updateData.type = body.type
    if (body.contact_email !== undefined) updateData.contact_email = body.contact_email
    if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone
    if (body.status !== undefined) updateData.status = body.status

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ organization: data })
  } catch (e: any) {
    console.error('[organizations/[id] PATCH]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// 조직 삭제
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // 조직에 속한 사용자가 있는지 확인
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('organization_id', id)
      .limit(1)

    if (users && users.length > 0) {
      return NextResponse.json(
        { error: '조직에 사용자가 있습니다. 먼저 사용자를 다른 조직으로 이동하거나 삭제하세요.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[organizations/[id] DELETE]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

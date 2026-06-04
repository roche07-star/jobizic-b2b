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

    console.log('[DELETE ORG] Starting deletion for org ID:', id)

    // 조직에 속한 사용자가 있는지 확인
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('organization_id', id)
      .limit(1)

    if (users && users.length > 0) {
      console.log('[DELETE ORG] Organization has users, cannot delete')
      return NextResponse.json(
        { error: '조직에 사용자가 있습니다. 먼저 사용자를 다른 조직으로 이동하거나 삭제하세요.' },
        { status: 400 }
      )
    }

    console.log('[DELETE ORG] No users found, deleting related data...')

    // 관련 데이터 삭제 (organization_id로 참조하는 모든 데이터)
    // candidates 삭제
    const { error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .delete()
      .eq('organization_id', id)

    if (candidatesError) {
      console.error('[DELETE ORG] Error deleting candidates:', candidatesError)
    }

    // job_descriptions 삭제
    const { error: jdError } = await supabaseAdmin
      .from('job_descriptions')
      .delete()
      .eq('organization_id', id)

    if (jdError) {
      console.error('[DELETE ORG] Error deleting JDs:', jdError)
    }

    // pipeline 삭제
    const { error: pipelineError } = await supabaseAdmin
      .from('pipeline')
      .delete()
      .eq('organization_id', id)

    if (pipelineError) {
      console.error('[DELETE ORG] Error deleting pipeline:', pipelineError)
    }

    console.log('[DELETE ORG] Related data deleted')

    // 조직 삭제
    const { error } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[DELETE ORG] Error deleting organization:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[DELETE ORG] Organization deleted successfully')
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[organizations/[id] DELETE]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

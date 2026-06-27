import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 30

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organization_id')
    const userEmail = searchParams.get('user_email')

    if (!organizationId || !userEmail) {
      return NextResponse.json({ error: '필수 파라미터가 없습니다.' }, { status: 400 })
    }

    const { id } = await context.params
    const body = await req.json()

    // organization_id로 권한 확인
    const { data: existing } = await supabaseAdmin
      .from('settlements')
      .select('headhunter_email, organization_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '정산을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (existing.headhunter_email !== userEmail) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    if (existing.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Organization이 일치하지 않습니다.' }, { status: 403 })
    }

    const updateData: any = {}
    const allowedFields = [
      'candidate_name',
      'candidate_email',
      'start_date',
      'salary',
      'commission_rate',
      'incentive_rate',
      'company',
      'position',
      'memo',
      'personal_override',
      'my_role',
      'partner_name',
      'my_ratio',
    ]

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    const { data, error } = await supabaseAdmin
      .from('settlements')
      .update(updateData)
      .eq('id', id)
      .eq('headhunter_email', userEmail)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (error) {
      console.error('[settlements PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settlement: data })
  } catch (e) {
    console.error('[settlements PATCH] Exception:', e)
    return NextResponse.json({ error: '수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(_req.url)
    const organizationId = searchParams.get('organization_id')
    const userEmail = searchParams.get('user_email')

    if (!organizationId || !userEmail) {
      return NextResponse.json({ error: '필수 파라미터가 없습니다.' }, { status: 400 })
    }

    const { id } = await context.params

    // organization_id로 권한 확인 및 삭제
    const { error } = await supabaseAdmin
      .from('settlements')
      .delete()
      .eq('id', id)
      .eq('headhunter_email', userEmail)
      .eq('organization_id', organizationId)

    if (error) {
      console.error('[settlements DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[settlements DELETE] Exception:', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

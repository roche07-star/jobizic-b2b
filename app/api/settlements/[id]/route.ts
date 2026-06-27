import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getSession, getProfile } from '@/lib/auth'

export const maxDuration = 30

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const profile = await getProfile()
    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Organization이 없습니다.' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()

    // RLS로 organization 격리되므로 조회만 해도 권한 확인됨
    const { data: existing } = await supabase
      .from('settlements')
      .select('headhunter_email, organization_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '정산을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (existing.headhunter_email !== profile.email) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    if (existing.organization_id !== profile.organization_id) {
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

    const { data, error } = await supabase
      .from('settlements')
      .update(updateData)
      .eq('id', id)
      .eq('headhunter_email', profile.email)
      .eq('organization_id', profile.organization_id)
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
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const profile = await getProfile()
    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Organization이 없습니다.' }, { status: 403 })
    }

    const { id } = await context.params

    // RLS로 organization 격리됨
    const { error } = await supabase
      .from('settlements')
      .delete()
      .eq('id', id)
      .eq('headhunter_email', profile.email)
      .eq('organization_id', profile.organization_id)

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

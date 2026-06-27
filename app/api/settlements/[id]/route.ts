import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabase } from '@/lib/supabase'

export const maxDuration = 30

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    if (session.user.userType !== 'HEADHUNTER') {
      return NextResponse.json({ error: '헤드헌터 전용 기능입니다.' }, { status: 403 })
    }

    if (session.user.plan === 'FREE') {
      return NextResponse.json(
        { error: 'PRO 이상 플랜이 필요합니다.', upgrade: true },
        { status: 402 }
      )
    }

    const { id } = await context.params
    const body = await req.json()

    const { data: existing } = await supabase
      .from('settlements')
      .select('headhunter_email')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '정산을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (existing.headhunter_email !== session.user.email) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
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
      .eq('headhunter_email', session.user.email)
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
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    if (session.user.userType !== 'HEADHUNTER') {
      return NextResponse.json({ error: '헤드헌터 전용 기능입니다.' }, { status: 403 })
    }

    if (session.user.plan === 'FREE') {
      return NextResponse.json(
        { error: 'PRO 이상 플랜이 필요합니다.', upgrade: true },
        { status: 402 }
      )
    }

    const { id } = await context.params

    const { error } = await supabase
      .from('settlements')
      .delete()
      .eq('id', id)
      .eq('headhunter_email', session.user.email)

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

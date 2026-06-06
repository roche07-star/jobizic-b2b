import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { data, error } = await supabaseAdmin
      .from('job_descriptions')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[api/jd/[id] GET]', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { user_email, user_role, ...updateData } = body

    // 권한 체크: status 변경은 모두 가능, 그 외 수정은 본인/owner/admin만
    if (Object.keys(updateData).some(key => key !== 'status')) {
      if (user_email && user_role) {
        const { data: jd } = await supabaseAdmin
          .from('job_descriptions')
          .select('created_by')
          .eq('id', id)
          .single()

        if (jd && jd.created_by !== user_email && user_role !== 'owner' && user_role !== 'admin') {
          return NextResponse.json({ error: '본인이 작성한 JD만 수정할 수 있습니다.' }, { status: 403 })
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('job_descriptions')
      .update(updateData)
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/jd/[id] PATCH]', e)
    return NextResponse.json({ error: '업데이트 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const url = new URL(req.url)
    const userEmail = url.searchParams.get('user_email')
    const userRole = url.searchParams.get('user_role')

    // 권한 체크: 본인/owner/admin만 삭제 가능
    if (userEmail && userRole) {
      const { data: jd } = await supabaseAdmin
        .from('job_descriptions')
        .select('created_by')
        .eq('id', id)
        .single()

      if (jd && jd.created_by !== userEmail && userRole !== 'owner' && userRole !== 'admin') {
        return NextResponse.json({ error: '본인이 작성한 JD만 삭제할 수 있습니다.' }, { status: 403 })
      }
    }

    const { error } = await supabaseAdmin
      .from('job_descriptions')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/jd/[id] DELETE]', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

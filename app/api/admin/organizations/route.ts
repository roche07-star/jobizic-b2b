import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserProfile } from '@/lib/api-helpers'

export async function GET() {
  try {
    // 관리자 권한 체크
    const profile = await getUserProfile()
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ organizations: data })
  } catch (e: any) {
    console.error('[admin/organizations GET]', e)
    return NextResponse.json({ error: e.message || '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 체크
    const profile = await getUserProfile()
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { name, type, contact_email, contact_phone } = await req.json()

    if (!name) {
      return NextResponse.json({ error: '조직명은 필수입니다.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('[admin/organizations POST]', e)
    return NextResponse.json({ error: e.message || '생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

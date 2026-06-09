import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/organizations/[id]/members - 조직 구성원 목록
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // 조직의 구성원 조회
    const { data: members, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('organization_id', id)
      .eq('is_active', true)
      .order('role', { ascending: true })
      .order('full_name', { ascending: true })

    if (error) {
      console.error('[organizations/[id]/members GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(members || [])
  } catch (e: any) {
    console.error('[organizations/[id]/members GET] Error:', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getServerProfile } from '@/lib/supabase-server'

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const profile = await getServerProfile()

    if (!profile) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    console.log('[recommendation delete] ID:', id, 'by:', profile.email, 'role:', profile.role)

    // 추천 정보 조회
    let query = supabaseAdmin
      .from('jd_recommendations')
      .select('*')
      .eq('id', id)

    // 권한 체크: PM은 본인에게 추천된 것만, Admin/Owner는 본인이 추천한 것 또는 조직 내 모든 추천
    if (profile.role === 'admin') {
      // Admin: 모든 추천 삭제 가능 (추가 필터 없음)
    } else if (profile.role === 'owner') {
      // Owner: 본인 조직의 추천만
      query = query.eq('organization_id', profile.organization_id)
    } else {
      // PM/Searcher: 본인에게 추천된 것만
      query = query.eq('recommended_to', profile.email)
    }

    const { data: recommendation, error: fetchError } = await query.single()

    if (fetchError || !recommendation) {
      console.error('[recommendation delete] Fetch error:', fetchError)
      console.error('[recommendation delete] Not found for user:', profile.email, 'role:', profile.role)
      return NextResponse.json({ error: '추천을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 삭제
    const { error: deleteError } = await supabaseAdmin
      .from('jd_recommendations')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[recommendation delete] Delete error:', deleteError)
      return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
    }

    console.log('[recommendation delete] ✅ Deleted')

    return NextResponse.json({
      success: true,
      message: '추천이 삭제되었습니다.'
    })

  } catch (error: any) {
    console.error('[recommendation delete] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

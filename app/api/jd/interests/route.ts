import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// 관심 JD 목록 조회
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('jd_interests')
      .select('jd_id')
      .eq('user_id', userId)

    if (error) {
      console.error('[jd/interests GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const jdIds = data?.map(item => item.jd_id) || []
    return NextResponse.json({ jd_ids: jdIds })
  } catch (e) {
    console.error('[jd/interests GET] Exception:', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 관심 JD 등록
export async function POST(req: NextRequest) {
  try {
    const { user_id, jd_id } = await req.json()

    if (!user_id || !jd_id) {
      return NextResponse.json({ error: 'user_id and jd_id are required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('jd_interests')
      .insert({ user_id, jd_id })

    if (error) {
      // 중복 체크
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 관심 등록된 JD입니다.' }, { status: 400 })
      }
      console.error('[jd/interests POST] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[jd/interests POST] Exception:', e)
    return NextResponse.json({ error: '등록 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 관심 JD 해제
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('user_id')
    const jdId = req.nextUrl.searchParams.get('jd_id')

    if (!userId || !jdId) {
      return NextResponse.json({ error: 'user_id and jd_id are required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('jd_interests')
      .delete()
      .eq('user_id', userId)
      .eq('jd_id', jdId)

    if (error) {
      console.error('[jd/interests DELETE] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[jd/interests DELETE] Exception:', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

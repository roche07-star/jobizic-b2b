import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: NextRequest) {
  try {
    // 세션에서 사용자 정보 가져오기
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    // 현재 사용자 확인
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 401 })
    }

    // profiles 테이블의 password_set 플래그 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ password_set: true })
      .eq('id', user.id)

    if (updateError) {
      console.error('[set-password-flag] Update error:', updateError)
      return NextResponse.json(
        { error: 'password_set 플래그 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[set-password-flag] Exception:', e)
    return NextResponse.json(
      { error: 'password_set 플래그 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

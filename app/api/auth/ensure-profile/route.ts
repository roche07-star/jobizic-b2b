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

    const { user_id, email, metadata } = await req.json()

    if (user_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    console.log('[ensure-profile] Ensuring profile for:', email, metadata)

    // Profile upsert (없으면 생성, 있으면 업데이트하지 않음)
    const { organization_id, full_name, role } = metadata || {}

    const profileData: any = {
      id: user_id,
      email: email,
      password_set: false, // 초대 이메일 방식
      is_active: true,
      role: role || 'headhunter'
    }

    if (organization_id) profileData.organization_id = organization_id
    if (full_name) profileData.full_name = full_name

    const { data, error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
        ignoreDuplicates: true // 이미 있으면 무시
      })
      .select()

    if (upsertError) {
      console.error('[ensure-profile] Upsert error:', upsertError)
      return NextResponse.json(
        { error: 'Profile 생성 중 오류가 발생했습니다.', details: upsertError.message },
        { status: 500 }
      )
    }

    console.log('[ensure-profile] Profile ensured:', data)

    return NextResponse.json({ success: true, profile: data })
  } catch (e: any) {
    console.error('[ensure-profile] Exception:', e)
    return NextResponse.json(
      { error: 'Profile 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

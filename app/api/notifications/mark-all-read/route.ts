import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// 모든 알림 읽음 처리
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('sb-fwmjqfadsrzbzkpwbwue-auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${authToken.value}`,
          },
        },
      }
    )

    // 현재 사용자의 모든 읽지 않은 알림을 읽음 처리
    const { data: user } = await supabase.auth.getUser()
    if (!user?.user?.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', user.user.id)
      .eq('is_read', false)

    if (error) {
      console.error('[notifications mark-all-read] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[notifications mark-all-read] Exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

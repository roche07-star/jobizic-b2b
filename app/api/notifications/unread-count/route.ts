import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// 읽지 않은 알림 개수 조회
export async function GET(req: NextRequest) {
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

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)

    if (error) {
      console.error('[notifications unread-count] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (e: any) {
    console.error('[notifications unread-count] Exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

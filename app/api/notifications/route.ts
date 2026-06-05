import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// 사용자의 알림 목록 조회
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

    const limit = req.nextUrl.searchParams.get('limit')
    const unreadOnly = req.nextUrl.searchParams.get('unread_only') === 'true'

    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (limit) {
      query = query.limit(parseInt(limit))
    }

    const { data, error } = await query

    if (error) {
      console.error('[notifications GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notifications: data || [] })
  } catch (e: any) {
    console.error('[notifications GET] Exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProfile } from '@/lib/auth'

/**
 * POST /api/admin/notifications
 * 관리자 알림 생성
 */
export async function POST(req: NextRequest) {
  try {
    const profile = await getProfile()
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, title, message, action_url, metadata } = body

    // 모든 admin + owner 사용자 조회
    const { data: adminUsers } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'owner'])

    if (!adminUsers || adminUsers.length === 0) {
      console.warn('[notifications] No admin users found')
      return NextResponse.json({ success: true, count: 0 })
    }

    // 각 admin에게 알림 생성
    const notifications = adminUsers.map(admin => ({
      user_id: admin.id,
      type,
      title,
      message: message || null,
      action_url: action_url || null,
      metadata: metadata || null,
      is_read: false
    }))

    const { error } = await supabaseAdmin
      .from('notifications')
      .insert(notifications)

    if (error) {
      console.error('[notifications] Insert error:', error)
      throw new Error(error.message)
    }

    console.log(`[notifications] ✅ Created ${notifications.length} notifications`)

    return NextResponse.json({
      success: true,
      count: notifications.length
    })

  } catch (err: any) {
    console.error('[notifications] Error:', err)
    return NextResponse.json({
      error: 'Failed to create notification',
      details: err.message
    }, { status: 500 })
  }
}

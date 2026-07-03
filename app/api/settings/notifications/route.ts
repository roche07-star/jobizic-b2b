import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProfile } from '@/lib/auth'

/**
 * PATCH /api/settings/notifications
 * 브라우저 알림 설정 업데이트
 */
export async function PATCH(req: NextRequest) {
  try {
    const profile = await getProfile()
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { browser_notifications_enabled } = await req.json()

    // profiles 테이블 업데이트
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ browser_notifications_enabled })
      .eq('id', profile.id)

    if (error) {
      console.error('[settings] Update error:', error)
      throw new Error(error.message)
    }

    console.log(`[settings] ✅ Browser notifications ${browser_notifications_enabled ? 'enabled' : 'disabled'} for ${profile.email}`)

    return NextResponse.json({
      success: true,
      browser_notifications_enabled
    })

  } catch (err: any) {
    console.error('[settings] Error:', err)
    return NextResponse.json({
      error: 'Failed to update settings',
      details: err.message
    }, { status: 500 })
  }
}

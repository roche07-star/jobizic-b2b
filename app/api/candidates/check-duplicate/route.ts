import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')
    const organizationId = req.nextUrl.searchParams.get('organization_id')

    if (!email || !organizationId) {
      return NextResponse.json({ exists: false })
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .select('id, name, email, created_by, created_at')
      .eq('email', email)
      .eq('organization_id', organizationId)
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      exists: true,
      candidate: data,
    })
  } catch (e) {
    console.error('[api/candidates/check-duplicate GET]', e)
    return NextResponse.json({ exists: false })
  }
}

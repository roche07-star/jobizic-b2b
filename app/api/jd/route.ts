import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    // 쿼리 파라미터에서 organization_id 받기 (클라이언트에서 전달)
    const organizationId = req.nextUrl.searchParams.get('organization_id')
    const role = req.nextUrl.searchParams.get('role')
    const userEmail = req.nextUrl.searchParams.get('user_email')
    const status = req.nextUrl.searchParams.get('status')

    let q = supabaseAdmin
      .from('job_descriptions')
      .select(`
        *,
        created_by_user:profiles!fk_jd_created_by_profile(id, full_name, email)
      `)
      .order('created_at', { ascending: false })

    // Role 기반 필터링
    console.log('[jd] User:', userEmail, 'Role:', role)

    // Searcher와 client는 같은 조직 JD만 조회
    if (role && (role === 'searcher' || role.startsWith('client_'))) {
      if (organizationId) {
        q = q.eq('organization_id', organizationId)
      }
    } else if (organizationId) {
      // admin, owner, PM은 organization_id가 있으면 필터링
      q = q.eq('organization_id', organizationId)
    }

    if (status) {
      q = q.eq('status', status)
    }

    const { data, error } = await q

    if (error) {
      console.error('[jd] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[jd] Found:', data?.length, 'JDs')
    if (data && data.length > 0) {
      console.log('[jd] Sample created_by values:', data.slice(0, 3).map(j => j.created_by))
    }

    return NextResponse.json({ jds: data ?? [] })
  } catch (e: any) {
    console.error('[api/jd GET]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { created_by } = body

    // 권한 체크: PM/owner만 JD 등록 가능
    if (created_by) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('email', created_by)
        .single()

      if (profile && profile.role === 'searcher') {
        return NextResponse.json(
          { error: 'Searcher는 JD를 등록할 수 없습니다. PM 또는 Owner에게 문의하세요.' },
          { status: 403 }
        )
      }

      if (profile && profile.role.startsWith('client_')) {
        return NextResponse.json(
          { error: '채용사 계정은 JD를 직접 등록할 수 없습니다.' },
          { status: 403 }
        )
      }
    }

    const { data, error } = await supabaseAdmin
      .from('job_descriptions')
      .insert(body)
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  } catch (e) {
    console.error('[api/jd POST]', e)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

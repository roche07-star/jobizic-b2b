import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCachedDashboard, setCachedDashboard } from '@/lib/cache-dashboard'

export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get('role')
    const userEmail = req.nextUrl.searchParams.get('user_email')
    const organizationId = req.nextUrl.searchParams.get('organization_id') || ''
    const userId = req.nextUrl.searchParams.get('user_id')

    if (!userEmail || !userId) {
      return NextResponse.json({ error: 'Missing required params' }, { status: 400 })
    }

    console.log('[dashboard] Loading for:', userEmail, 'role:', role, 'org:', organizationId)

    // 캐시 확인 (1분 TTL)
    const cached = await getCachedDashboard(userEmail, organizationId, { ttl: 60 })
    if (cached) {
      console.log('[dashboard] Cache hit!')
      return NextResponse.json(cached)
    }

    // 병렬로 모든 데이터 조회
    const [jdData, candidatesCount, pipelineData, interestsData, organizationsData] = await Promise.all([
      // 1. JD 조회
      (async () => {
        let q = supabaseAdmin.from('job_descriptions').select('*')

        if (role === 'admin' && organizationId && organizationId !== '전체') {
          q = q.eq('organization_id', organizationId)
        } else if (role !== 'admin' && organizationId) {
          q = q.eq('organization_id', organizationId)
        }

        const { data, error } = await q
        return { data: data ?? [], error }
      })(),

      // 2. 후보자 Count (전체 데이터 로드 안 함)
      (async () => {
        let q = supabaseAdmin.from('candidates').select('*', { count: 'exact', head: true })

        if (role !== 'admin' && organizationId) {
          q = q.eq('organization_id', organizationId)
        }

        const { count, error } = await q
        return { count: count ?? 0, error }
      })(),

      // 3. Pipeline 조회
      (async () => {
        let q = supabaseAdmin.from('pipeline').select('*')

        if (role !== 'admin' && organizationId) {
          q = q.eq('organization_id', organizationId)
        }

        const { data, error } = await q
        return { data: data ?? [], error }
      })(),

      // 4. 관심 JD
      supabaseAdmin
        .from('jd_interests')
        .select('jd_id')
        .eq('user_id', userId),

      // 5. 조직 목록 (admin만)
      role === 'admin'
        ? supabaseAdmin.from('organizations').select('id, name').order('name')
        : { data: null, error: null }
    ])

    // 에러 체크
    if (jdData.error) {
      console.error('[dashboard] JD query error:', jdData.error)
      throw jdData.error
    }
    if (candidatesCount.error) {
      console.error('[dashboard] Candidates count error:', candidatesCount.error)
      throw candidatesCount.error
    }
    if (pipelineData.error) {
      console.error('[dashboard] Pipeline query error:', pipelineData.error)
      throw pipelineData.error
    }

    const jds = jdData.data
    const pipeline = pipelineData.data
    const interestIds = interestsData.data?.map(i => i.jd_id) ?? []

    console.log('[dashboard] Loaded:', jds.length, 'JDs,', candidatesCount.count, 'candidates,', pipeline.length, 'pipeline')

    // 통계 계산
    const now = new Date()
    const thisMonth = pipeline.filter((p: any) => {
      const created = new Date(p.created_at)
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
    }).length

    const myJDs = jds.filter((jd: any) => jd.created_by === userEmail).length
    const interestCount = myJDs + interestIds.length

    const stats = {
      totalJDs: jds.length,
      interestJDs: interestCount,
      totalCandidates: candidatesCount.count,
      thisMonthMatches: thisMonth,
      activePipelines: pipeline.filter((p: any) => p.is_active).length,
    }

    // 관심 JD 목록
    const recentJDs = jds
      .filter((jd: any) => jd.created_by === userEmail || interestIds.includes(jd.id))
      .map((jd: any) => {
        const jdPipelines = pipeline.filter((p: any) => p.jd_id === jd.id)
        const activePipelines = jdPipelines.filter((p: any) => p.is_active)

        return {
          ...jd,
          pipelineCount: jdPipelines.length,
          activePipelineCount: activePipelines.length,
        }
      })

    // admin/owner/headhunter는 대시보드 통계도 포함
    let dashboardStats = null
    if ((role === 'admin' || role === 'owner' || role === 'headhunter') && organizationId && organizationId !== '전체') {
      try {
        const statsParams = new URLSearchParams({
          role: role,
          organization_id: organizationId,
          user_email: userEmail,
        })
        const statsRes = await fetch(`${req.nextUrl.origin}/api/dashboard/stats?${statsParams}`)
        if (statsRes.ok) {
          dashboardStats = await statsRes.json()
        }
      } catch (error) {
        console.error('[dashboard] Failed to load stats:', error)
        // 통계 로드 실패해도 계속 진행
      }
    }

    const result = {
      stats,
      recentJDs,
      dashboardStats,
      organizations: organizationsData.data ?? [],
    }

    // 캐시 저장
    await setCachedDashboard(userEmail, organizationId, result, { ttl: 60 })

    console.log('[dashboard] Success! Returning', recentJDs.length, 'recent JDs')

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[dashboard] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

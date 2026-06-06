import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get('role')
    const organizationId = req.nextUrl.searchParams.get('organization_id')
    const userEmail = req.nextUrl.searchParams.get('user_email')

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
    }

    // PM은 본인 데이터만
    const isPM = role === 'headhunter'
    const filterByUser = isPM && userEmail

    // 1. 조직의 모든 멤버 조회
    const { data: members } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('full_name')

    // 2. JD 통계
    let jdQuery = supabaseAdmin
      .from('job_descriptions')
      .select('id, created_by, status')
      .eq('organization_id', organizationId)

    // PM은 본인 JD만
    if (filterByUser) {
      jdQuery = jdQuery.eq('created_by', userEmail)
    }

    const { data: jds } = await jdQuery

    // 3. 후보자 통계
    let candidateQuery = supabaseAdmin
      .from('candidates')
      .select('id, created_by, organization_id')
      .eq('organization_id', organizationId)

    // PM은 본인 후보자만
    if (filterByUser) {
      candidateQuery = candidateQuery.eq('created_by', userEmail)
    }

    const { data: candidates } = await candidateQuery

    // 4. 채용 프로세스 통계 (본인 JD에 연결된 파이프라인만)
    let pipelines = null

    if (jds && jds.length > 0) {
      const pipelineQuery = supabaseAdmin
        .from('pipeline')
        .select('id, created_by, stage, jd_id, is_active')
        .in('jd_id', jds.map(jd => jd.id))

      const { data } = await pipelineQuery
      pipelines = data
    }

    // 멤버별 통계 계산 (Owner만)
    const memberStats = isPM ? [] : (members || []).map(member => {
      const memberJDs = (jds || []).filter(jd => jd.created_by === member.email)
      const memberCandidates = (candidates || []).filter(c => c.created_by === member.email)
      const memberPipelines = (pipelines || []).filter(p => p.created_by === member.email)

      return {
        id: member.id,
        name: member.full_name || member.email,
        email: member.email,
        role: member.role,
        jdCount: memberJDs.length,
        candidateCount: memberCandidates.length,
        pipelineCount: memberPipelines.length,
        activePipelineCount: memberPipelines.filter(p => p.is_active).length,
      }
    })

    // JD 상태별 통계
    const jdByStatus = {
      active: (jds || []).filter(jd => jd.status === '활성').length,
      closed: (jds || []).filter(jd => jd.status === '완료').length,
      hold: (jds || []).filter(jd => jd.status === '보류').length,
    }

    // 파이프라인 단계별 통계
    const pipelineByStage = (pipelines || []).reduce((acc: any, p) => {
      const stage = p.stage || '신규'
      acc[stage] = (acc[stage] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      memberStats,
      jdByStatus,
      pipelineByStage,
      totals: {
        members: members?.length || 0,
        jds: jds?.length || 0,
        candidates: candidates?.length || 0,
        pipelines: pipelines?.length || 0,
        activePipelines: (pipelines || []).filter(p => p.is_active).length,
      },
    })
  } catch (e: any) {
    console.error('[dashboard/stats GET]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

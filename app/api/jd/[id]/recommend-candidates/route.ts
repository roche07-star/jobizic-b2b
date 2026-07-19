import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getServerProfile } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import { getMatchingPrompt } from '@/lib/prompts/base-headhunter'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 매칭 결과 타입
interface MatchingResult {
  match_score: number
  match_reason: string
  skill_match_rate: number
  experience_match: string
  strength_for_jd: string[]
  concerns: string[]
  recommendation: '추천' | '보류' | '부적합'
  next_steps: string
}

const MATCHING_TOOL: Anthropic.Tool = {
  name: 'analyze_jd_candidate_match',
  description: 'JD와 후보자의 매칭 분석 결과를 구조화된 형식으로 반환',
  input_schema: {
    type: 'object',
    properties: {
      match_score: { type: 'number', description: '0-100 사이의 매칭 점수' },
      match_reason: { type: 'string', description: '매칭 근거 2-3문장' },
      skill_match_rate: { type: 'number', description: '0-100 사이의 스킬 매칭률' },
      experience_match: { type: 'string', description: '경력 적합도 평가' },
      strength_for_jd: { type: 'array', items: { type: 'string' }, description: '이 JD에 대한 후보자 강점 (최대 3개)' },
      concerns: { type: 'array', items: { type: 'string' }, description: '우려사항 (최대 4개)' },
      recommendation: { type: 'string', enum: ['추천', '보류', '부적합'], description: '최종 추천 여부' },
      next_steps: { type: 'string', description: '다음 단계 제안' }
    },
    required: ['match_score', 'match_reason', 'skill_match_rate', 'experience_match', 'strength_for_jd', 'concerns', 'recommendation', 'next_steps']
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: jdId } = await context.params
    const profile = await getServerProfile()

    if (!profile) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 권한 체크: super admin만 실행 가능
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    // 최소 점수 파라미터 (기본값 70점)
    const body = await req.json().catch(() => ({}))
    const minScore = body.min_score || 70

    console.log('[recommend-candidates] Starting for JD:', jdId, 'by admin:', profile.email, 'min_score:', minScore)

    // 1. JD 정보 조회 (Super Admin은 모든 조직의 JD 접근 가능)
    const { data: jd, error: jdError } = await supabaseAdmin
      .from('job_descriptions')
      .select('*')
      .eq('id', jdId)
      .single()

    if (jdError || !jd) {
      return NextResponse.json({ error: 'JD를 찾을 수 없습니다.' }, { status: 404 })
    }

    console.log('[recommend-candidates] JD found:', jd.company, jd.position, 'org:', jd.organization_id)

    // 2. 후보자 필터링 (스킬, 경력)
    const requiredSkills = jd.required_skills || []
    const preferredSkills = jd.preferred_skills || []
    const allSkills = [...requiredSkills, ...preferredSkills]

    console.log('[recommend-candidates] Filtering candidates by skills:', allSkills)

    // JD 조직 내 후보자 조회 (Super Admin은 JD의 organization_id 사용)
    const { data: allCandidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('organization_id', jd.organization_id)
      .eq('status', '활성')

    if (candidatesError) {
      console.error('[recommend-candidates] Candidates query error:', candidatesError)
      return NextResponse.json({ error: '후보자 조회 실패' }, { status: 500 })
    }

    console.log('[recommend-candidates] Total candidates in org:', allCandidates?.length || 0)

    // 테스트: 스킬 필터 제거, 모든 후보 대상으로 AI 분석 (최대 30명)
    const filteredCandidates = (allCandidates || []).slice(0, 30)

    console.log('[recommend-candidates] Candidates for AI analysis:', filteredCandidates.length)

    if (filteredCandidates.length === 0) {
      return NextResponse.json({
        message: '조직에 후보자가 없습니다.',
        total: 0,
        recommendations: []
      })
    }

    // 3. Claude API로 매칭 분석 (병렬 처리)
    const matchingPromises = filteredCandidates.map(async (candidate) => {
      try {
        const safeJoin = (arr: any, separator: string = ', '): string => {
          if (Array.isArray(arr) && arr.length > 0) {
            return arr.join(separator)
          }
          return '없음'
        }

        const currentDate = new Date().toLocaleDateString('ko-KR')

        const userPrompt = `**중요: 오늘은 ${currentDate}입니다.**

다음 JD와 후보자의 적합도를 분석해주세요:

【JD 정보】
- 회사: ${jd.company ?? '미상'}
- 포지션: ${jd.position}
- 필수 스킬: ${safeJoin(jd.required_skills)}
- 우대 스킬: ${safeJoin(jd.preferred_skills)}
- 타깃 프로파일: ${jd.target_profile ?? '없음'}

【후보자 정보】
- 현재 포지션: ${candidate.current_position ?? '미상'}
- 경력: ${candidate.total_experience_years ? `${candidate.total_experience_years}년` : '미상'}
- 스킬: ${safeJoin(candidate.skills)}
- 기술스택: ${safeJoin(candidate.tech_stack)}
- 자격증: ${safeJoin(candidate.certifications)}
- 학력: ${safeJoin(candidate.education)}
- 강점 요약: ${candidate.strength_summary ?? '없음'}
- 약점 분석: ${candidate.weakness_summary ?? '없음'}

**[JD 분석 절차]**
STEP 1 — JD 핵심 요구 역량 추출 (필수/우대/숨은 요구)
STEP 2 — 타깃 프로파일 한 줄 정의
STEP 3 — 후보자-JD 대조 및 분석
`

        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          system: [{
            type: 'text',
            text: getMatchingPrompt(),
            cache_control: { type: 'ephemeral' }
          }],
          tools: [MATCHING_TOOL],
          tool_choice: { type: 'tool', name: 'analyze_jd_candidate_match' },
          messages: [{ role: 'user', content: userPrompt }],
        })

        const toolUseBlock = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
        if (!toolUseBlock) {
          console.error('[recommend-candidates] No tool_use for candidate:', candidate.id)
          return null
        }

        const result = toolUseBlock.input as MatchingResult

        return {
          candidate_id: candidate.id,
          candidate_name: candidate.name,
          match_score: result.match_score,
          match_reason: result.match_reason,
          skill_match_rate: result.skill_match_rate,
          experience_match: result.experience_match,
          strength_for_jd: result.strength_for_jd,
          concerns: result.concerns,
          recommendation: result.recommendation,
          next_steps: result.next_steps
        }
      } catch (err) {
        console.error('[recommend-candidates] Matching error for candidate:', candidate.id, err)
        return null
      }
    })

    const matchingResults = (await Promise.all(matchingPromises)).filter(r => r !== null)

    console.log('[recommend-candidates] Matching complete:', matchingResults.length)

    // 매칭 결과 점수 분포 로그
    const scores = matchingResults.map(r => r?.match_score || 0).sort((a, b) => b - a)
    console.log('[recommend-candidates] Score distribution:', scores)

    // 4. 점수 필터링 및 상위 10명 선정 (매칭 점수 순)
    const topCandidates = matchingResults
      .filter(r => (r?.match_score || 0) >= minScore) // 최소 점수 필터
      .sort((a, b) => (b?.match_score || 0) - (a?.match_score || 0))
      .slice(0, 10)

    console.log('[recommend-candidates] Min score:', minScore, '/ Filtered:', topCandidates.length)
    console.log('[recommend-candidates] Top scores:', topCandidates.map(r => r?.match_score))

    // 5. DB에 저장
    const insertData = topCandidates.map(r => ({
      jd_id: jdId,
      candidate_id: r!.candidate_id,
      match_score: r!.match_score,
      match_reason: r!.match_reason,
      skill_match_rate: r!.skill_match_rate,
      experience_match: r!.experience_match,
      strength_for_jd: r!.strength_for_jd,
      concerns: r!.concerns,
      recommendation: r!.recommendation,
      next_steps: r!.next_steps,
      status: 'pending',
      organization_id: jd.organization_id, // JD의 조직 ID
      recommended_to: jd.created_by // PM 이메일
    }))

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('jd_recommendations')
      .upsert(insertData, { onConflict: 'jd_id,candidate_id' })
      .select()

    if (insertError) {
      console.error('[recommend-candidates] Insert error:', insertError)
      return NextResponse.json({ error: '저장 실패' }, { status: 500 })
    }

    console.log('[recommend-candidates] ✅ Saved:', inserted?.length || 0, 'recommendations')

    return NextResponse.json({
      message: `${topCandidates.length}명의 추천 후보를 찾았습니다.`,
      total: topCandidates.length,
      recommendations: topCandidates
    })

  } catch (error: any) {
    console.error('[recommend-candidates] Fatal error:', error)
    return NextResponse.json({
      error: '서버 오류가 발생했습니다.',
      details: error.message
    }, { status: 500 })
  }
}

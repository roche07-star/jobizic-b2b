import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getMatchingPrompt } from '@/lib/prompts/base-headhunter'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 📝 매칭 결과 타입 정의
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

// 🔧 Tool 정의: 매칭 분석 결과 구조화
const MATCHING_TOOL: Anthropic.Tool = {
  name: 'analyze_jd_candidate_match',
  description: 'JD와 후보자의 매칭 분석 결과를 구조화된 형식으로 반환',
  input_schema: {
    type: 'object',
    properties: {
      match_score: {
        type: 'number',
        description: '0-100 사이의 매칭 점수'
      },
      match_reason: {
        type: 'string',
        description: '매칭 근거 2-3문장 (구체적 수치와 근거 포함)'
      },
      skill_match_rate: {
        type: 'number',
        description: '0-100 사이의 스킬 매칭률'
      },
      experience_match: {
        type: 'string',
        description: '경력 적합도 평가 2문장 (연수, 직급, 산업 경험 기준)'
      },
      strength_for_jd: {
        type: 'array',
        items: { type: 'string' },
        description: '이 JD에 대한 후보자 강점 (반드시 구체적 근거 포함, 최대 3개)'
      },
      concerns: {
        type: 'array',
        items: { type: 'string' },
        description: '우려사항 (가장 치명적인 것부터 정렬, 최대 4개)'
      },
      recommendation: {
        type: 'string',
        enum: ['추천', '보류', '부적합'],
        description: '최종 추천 여부'
      },
      next_steps: {
        type: 'string',
        description: '다음 단계 제안 (예: 1차 면접 추천, 자격증 확인 후 재검토 등)'
      }
    },
    required: ['match_score', 'match_reason', 'skill_match_rate', 'experience_match', 'strength_for_jd', 'concerns', 'recommendation', 'next_steps']
  }
}

export async function POST(req: NextRequest) {
  try {
    const { jd, candidate, client_comment } = await req.json()
    if (!jd || !candidate) {
      return NextResponse.json({ error: 'JD와 후보자 정보가 필요합니다.' }, { status: 400 })
    }

    console.log('[pipeline/match] ========== STARTING MATCH ANALYSIS ==========')
    console.log('[pipeline/match] JD data received:', {
      id: jd.id,
      position: jd.position,
      company: jd.company,
      required_skills: jd.required_skills,
      preferred_skills: jd.preferred_skills,
      difficulty: jd.difficulty,
      target_profile: jd.target_profile?.substring(0, 50),
      search_strategy: jd.search_strategy?.substring(0, 50)
    })
    console.log('[pipeline/match] Candidate data received:', {
      id: candidate.id,
      current_position: candidate.current_position,
      total_experience_years: candidate.total_experience_years,
      skills: candidate.skills,
      tech_stack: candidate.tech_stack,
      certifications: candidate.certifications,
      education: candidate.education,
      hasStrength: !!candidate.strength_summary,
      hasWeakness: !!candidate.weakness_summary,
      hasCareerSummary: !!candidate.career_summary,
      hasCareerTrajectory: !!candidate.career_trajectory
    })

    // 안전한 배열 처리 헬퍼 함수
    const safeJoin = (arr: any, separator: string = ', '): string => {
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.join(separator)
      }
      return '없음'
    }

    console.log('[pipeline/match] Calling Claude API...')

    // 현재 날짜 (경력 계산용)
    const today = new Date()
    const currentDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

    // 🔍 프롬프트 생성 및 검증
    const userPrompt = `**중요: 오늘은 ${currentDate}입니다. 경력 기간 계산 시 이 날짜를 기준으로 정확히 계산해주세요.**

다음 JD와 후보자의 적합도를 분석해주세요:

【JD 정보】
- 회사: ${jd.company ?? '미상'}
- 포지션: ${jd.position}
- 필수 스킬: ${safeJoin(jd.required_skills)}
- 우대 스킬: ${safeJoin(jd.preferred_skills)}
- 난이도: ${jd.difficulty}
- 타깃 프로파일: ${jd.target_profile ?? '없음'}
- 서칭 전략: ${jd.search_strategy ?? '없음'}

【후보자 정보】
🔒 개인정보 보호: 이름, 회사명 등 개인정보는 제외됨
- 현재 포지션: ${candidate.current_position ?? '미상'}
- 경력: ${candidate.total_experience_years ? `${candidate.total_experience_years}년` : '미상'}
- 스킬: ${safeJoin(candidate.skills)}
- 기술스택: ${safeJoin(candidate.tech_stack)}
- 자격증: ${safeJoin(candidate.certifications)}
- 학력: ${safeJoin(candidate.education)}
- 강점 요약: ${candidate.strength_summary ?? '없음'}
- 약점 분석: ${candidate.weakness_summary ?? '없음'}
- 커리어 방향: ${candidate.career_trajectory ?? '없음'}
- 경력 요약: ${candidate.career_summary ?? '없음'}
${client_comment ? `

【클라이언트 코멘트】
${client_comment}

**⚠️ 클라이언트 코멘트를 반드시 반영하여 분석:**
- 요건 완화/강화 사항 확인
- 우선순위 변경 사항 반영
- 기피 프로파일 주의
- 처우 조건 고려
- strength_for_jd, concerns에 코멘트 내용 통합` : ''}
`
    console.log('[pipeline/match] 📝 User prompt:', userPrompt.substring(0, 300) + '...')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: [{
        type: 'text',
        text: getMatchingPrompt(), // ✨ Enhanced prompt from ADAM
        cache_control: { type: 'ephemeral' }
      }],
      tools: [MATCHING_TOOL],
      tool_choice: { type: 'tool', name: 'analyze_jd_candidate_match' }, // 필수 사용
      messages: [{
        role: 'user',
        content: userPrompt
      }],
    })

    console.log('[pipeline/match] ✅ Claude API response received')

    // 📊 Prompt Caching Usage 로깅
    if (message.usage) {
      console.log('[pipeline/match] 💰 Token Usage:', {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        cache_creation_input_tokens: message.usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: message.usage.cache_read_input_tokens || 0
      })

      const cacheHitRate = message.usage.cache_read_input_tokens
        ? (message.usage.cache_read_input_tokens / (message.usage.input_tokens + message.usage.cache_read_input_tokens) * 100).toFixed(1)
        : 0
      console.log('[pipeline/match] 📈 Cache Hit Rate:', `${cacheHitRate}%`)
    }

    // 🎯 Tool Use 블록 추출
    if (!message.content || message.content.length === 0) {
      console.error('[pipeline/match] ❌ Empty content from Claude')
      return NextResponse.json({
        error: 'AI 응답이 비어있습니다.',
        details: 'Claude API returned empty content'
      }, { status: 500 })
    }

    // Tool use 블록 찾기
    const toolUseBlock = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')

    if (!toolUseBlock) {
      console.error('[pipeline/match] ❌ No tool_use block found in response')
      console.error('[pipeline/match] ❌ Content blocks:', message.content.map(b => b.type))
      return NextResponse.json({
        error: '매칭 분석 실패. AI가 tool을 사용하지 않았습니다.',
        details: 'No tool_use block found in response'
      }, { status: 500 })
    }

    if (toolUseBlock.name !== 'analyze_jd_candidate_match') {
      console.error('[pipeline/match] ❌ Unexpected tool name:', toolUseBlock.name)
      return NextResponse.json({
        error: '매칭 분석 실패. 잘못된 tool이 호출되었습니다.',
        details: `Expected analyze_jd_candidate_match, got ${toolUseBlock.name}`
      }, { status: 500 })
    }

    // ✅ Tool input이 바로 결과!
    const result = toolUseBlock.input as MatchingResult
    console.log('[pipeline/match] ✅ Tool use extracted successfully')
    console.log('[pipeline/match] ✅ Analysis complete. Score:', result.match_score)

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[pipeline/match] ❌❌❌ FATAL ERROR ❌❌❌')
    console.error('[pipeline/match] Error name:', e.name)
    console.error('[pipeline/match] Error message:', e.message)
    console.error('[pipeline/match] Error stack:', e.stack)

    // Anthropic API 에러 상세 정보
    if (e.status) {
      console.error('[pipeline/match] Anthropic API status:', e.status)
      console.error('[pipeline/match] Anthropic API error:', e.error)
    }

    return NextResponse.json({
      error: '서버 오류가 발생했습니다.',
      details: e.message || 'Unknown error'
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getMatchingPrompt } from '@/lib/prompts/base-headhunter'
import { VALIDATION_PROMPT, ValidationResult } from '@/lib/prompts/validation'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

// 🔍 검증 Tool (하이브리드 하네스 엔지니어링)
const validationTool: Anthropic.Tool = {
  name: 'validate_analysis',
  description: '1차 분석 결과를 검증하고 문제를 찾아 수정합니다.',
  input_schema: {
    type: 'object' as const,
    properties: {
      career_level_issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            original: { type: 'string', description: '원본 우려사항/강점' },
            reason: { type: 'string', description: '문제 이유 (연차별 기준 위반)' },
            corrected: { type: 'string', description: '수정된 내용' },
          },
          required: ['original', 'reason', 'corrected'],
        },
        description: '연차별 비현실적 기대치 문제들',
      },
      hallucination_issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            original: { type: 'string', description: '원본 우려사항/약점' },
            reason: { type: 'string', description: '환각 이유 (이력서에 명시된 내용)' },
            action: { type: 'string', enum: ['remove', 'keep'], description: '삭제 여부' },
          },
          required: ['original', 'reason', 'action'],
        },
        description: '이력서 명시 내용을 약점으로 지적한 환각들',
      },
      generic_phrase_issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            original: { type: 'string', description: '원본 강점' },
            reason: { type: 'string', description: '빈 말 이유 (구체성 없음)' },
            has_specifics: { type: 'boolean', description: '수치/프로젝트명 포함 여부' },
          },
          required: ['original', 'reason', 'has_specifics'],
        },
        description: '구체성 없는 빈 말 강점들',
      },
      corrected_concerns: {
        type: 'array',
        items: { type: 'string' },
        description: '수정된 우려사항 목록 (문제 없으면 원본 그대로)',
      },
      corrected_strengths: {
        type: 'array',
        items: { type: 'string' },
        description: '수정된 강점 목록 (문제 없으면 원본 그대로)',
      },
      validation_passed: {
        type: 'boolean',
        description: '검증 통과 여부 (문제 없으면 true)',
      },
    },
    required: ['career_level_issues', 'hallucination_issues', 'generic_phrase_issues', 'corrected_concerns', 'corrected_strengths', 'validation_passed'],
  },
}

export async function POST(req: NextRequest) {
  try {
    const { jd, candidate, client_comment, created_by } = await req.json()
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

    // 🔍 프롬프트 생성 (Eve 기본 + Adam JD 분석)
    const userPrompt = `**중요: 오늘은 ${currentDate}입니다. 경력 기간 계산 시 이 날짜를 기준으로 정확히 계산해주세요.**

다음 JD와 후보자의 적합도를 분석해주세요:

【JD 정보】
- 회사: ${jd.company ?? '미상'}
- 포지션: ${jd.position}
- 필수 스킬: ${safeJoin(jd.required_skills)}
- 우대 스킬: ${safeJoin(jd.preferred_skills)}
- 난이도: ${jd.difficulty ?? '없음'}
- 타깃 프로파일: ${jd.target_profile ?? '없음'}
- 서칭 전략: ${jd.search_strategy ?? '없음'}
${jd.raw_text ? `\nJD 원문:\n${jd.raw_text.substring(0, 2000)}` : ''}

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

**[JD 분석 절차 - Adam 방식]**

STEP 1 — JD 핵심 요구 역량 추출
JD를 읽고 요구사항을 3가지로 분리합니다:
① 필수 요건(없으면 탈락): 최소 학력/전공, 최소 경력 연수, 특정 도메인/직무 경험, 자격증/어학
② 우대 사항(있으면 가산점): 특정 툴/플랫폼, 관련 업종, 특수 환경(해외/IPO/스타트업 등)
③ 숨은 요구 역량(JD에 없지만 맥락상 필요한 것): "글로벌 팀 협업"→영어 실무, "C-level 보고"→문서화 능력, "스타트업 환경"→멀티태스킹, "팀 리딩"→실제 인사권 여부, "외부 파트너"→협상 경험

STEP 2 — 타깃 프로파일 한 줄 정의
STEP 1을 종합해 "[도메인]에서 [N]년 이상 [핵심 직무]를 직접 수행한 경험이 있으며, [환경]에서 [역할]을 해본 [직급대] 인재" 형식으로 기준선을 먼저 정한 뒤 후보자를 대조합니다.

STEP 3 — 후보자-JD 대조 및 분석
위 JD 분석 결과를 바탕으로 후보자의 strength_for_jd, concerns를 도출하십시오.
`
    console.log('[pipeline/match] 📝 User prompt:', userPrompt.substring(0, 300) + '...')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: [{
        type: 'text',
        text: getMatchingPrompt(), // ✨ Eve 기본 프롬프트 (Adam JD 분석 추가됨)
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

    // 하이브리드 하네스 검증 단계
    try {
      const candidateResume = `
현재 포지션: ${candidate.current_position ?? '미상'}
경력: ${candidate.total_experience_years ? `${candidate.total_experience_years}년` : '미상'}
스킬: ${safeJoin(candidate.skills)}
강점 요약: ${candidate.strength_summary ?? '없음'}
약점 분석: ${candidate.weakness_summary ?? '없음'}
경력 요약: ${candidate.career_summary ?? '없음'}
`.trim()

      const validationPrompt = `${VALIDATION_PROMPT}

[1차 분석 결과]
총 경력: ${candidate.total_experience_years ?? '미상'}년
우려사항 (concerns): ${JSON.stringify(result.concerns, null, 2)}
강점 (strength_for_jd): ${JSON.stringify(result.strength_for_jd, null, 2)}

[후보자 이력서 정보]
${candidateResume}

위 1차 분석 결과를 검증하고, 문제가 있으면 수정하십시오.
- concerns를 검증하여 corrected_concerns로 반환
- strength_for_jd를 검증하여 corrected_strengths로 반환`

      const validationMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        tool_choice: { type: 'tool', name: 'validate_analysis' },
        tools: [validationTool],
        messages: [{ role: 'user', content: validationPrompt }],
      })

      const validationTU = validationMsg.content.find(c => c.type === 'tool_use')
      if (validationTU && validationTU.type === 'tool_use') {
        const validation = validationTU.input as ValidationResult & { corrected_concerns?: string[] }
        if (!validation.validation_passed) {
          console.log('[pipeline/match] ⚠️ 검증 실패 - 자동 수정:', {
            career_level_issues: validation.career_level_issues.length,
            hallucination_issues: validation.hallucination_issues.length,
            generic_phrase_issues: validation.generic_phrase_issues.length,
          })
          // 문제 발견 시 자동 수정
          if (validation.corrected_concerns && validation.corrected_concerns.length > 0) {
            result.concerns = validation.corrected_concerns
          }
          if (validation.corrected_strengths.length > 0) {
            result.strength_for_jd = validation.corrected_strengths
          }
        } else {
          console.log('[pipeline/match] ✅ 검증 통과 - 문제 없음')
        }
      }
    } catch (err) {
      console.error('[pipeline/match] validation error (non-fatal):', err)
      // 검증 실패해도 매칭은 계속 진행
    }

    // 💾 DB에 매칭 결과 저장 (upsert)
    try {
      const { error: saveError } = await supabaseAdmin
        .from('jd_candidate_matches')
        .upsert({
          jd_id: jd.id,
          candidate_id: candidate.id,
          match_score: result.match_score,
          match_reason: result.match_reason,
          skill_match_rate: result.skill_match_rate,
          experience_match: result.experience_match,
          strength_for_jd: result.strength_for_jd,
          concerns: result.concerns,
          recommendation: result.recommendation,
          next_steps: result.next_steps,
          organization_id: jd.organization_id || candidate.organization_id,
          created_by: created_by || jd.created_by || 'system',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'jd_id,candidate_id' // JD + 후보자 조합이 중복이면 업데이트
        })

      if (saveError) {
        console.error('[pipeline/match] ⚠️ DB 저장 실패 (non-fatal):', saveError)
        // DB 저장 실패해도 매칭 결과는 반환
      } else {
        console.log('[pipeline/match] ✅ 매칭 결과 DB 저장 완료')
      }
    } catch (err) {
      console.error('[pipeline/match] ⚠️ DB 저장 중 에러 (non-fatal):', err)
    }

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

// GET: JD 또는 후보자에 대한 모든 매칭 결과 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jdId = searchParams.get('jd_id')
    const candidateId = searchParams.get('candidate_id')

    if (!jdId && !candidateId) {
      return NextResponse.json({ error: 'jd_id 또는 candidate_id가 필요합니다.' }, { status: 400 })
    }

    // 매칭 결과 조회 (JD 정보 포함)
    let query = supabaseAdmin
      .from('jd_candidate_matches')
      .select(`
        *,
        job_descriptions (
          id,
          company,
          position
        )
      `)

    if (jdId) {
      query = query.eq('jd_id', jdId)
    }
    if (candidateId) {
      query = query.eq('candidate_id', candidateId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[pipeline/match] GET error:', error)
      return NextResponse.json({ error: 'DB 조회 실패' }, { status: 500 })
    }

    // jd_id로 조회 시 candidate_id를 key로, candidate_id로 조회 시 jd_id를 key로
    const matches: Record<string, any> = {}
    const keyField = jdId ? 'candidate_id' : 'jd_id'

    data.forEach(match => {
      matches[match[keyField]] = {
        match_score: match.match_score,
        match_reason: match.match_reason,
        skill_match_rate: match.skill_match_rate,
        experience_match: match.experience_match,
        strength_for_jd: match.strength_for_jd,
        concerns: match.concerns,
        recommendation: match.recommendation,
        next_steps: match.next_steps,
        jd_id: match.jd_id,
        candidate_id: match.candidate_id,
        // JD 정보 추가
        jd_company: match.job_descriptions?.company,
        jd_position: match.job_descriptions?.position
      }
    })

    return NextResponse.json(matches)
  } catch (e: any) {
    console.error('[pipeline/match] GET error:', e)
    return NextResponse.json({
      error: '서버 오류가 발생했습니다.',
      details: e.message || 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE: 매칭 분석 결과 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jdId = searchParams.get('jd_id')
    const candidateId = searchParams.get('candidate_id')

    if (!jdId || !candidateId) {
      return NextResponse.json({ error: 'jd_id와 candidate_id가 필요합니다.' }, { status: 400 })
    }

    // 매칭 결과 삭제
    const { error } = await supabaseAdmin
      .from('jd_candidate_matches')
      .delete()
      .eq('jd_id', jdId)
      .eq('candidate_id', candidateId)

    if (error) {
      console.error('[pipeline/match] DELETE error:', error)
      return NextResponse.json({ error: 'DB 삭제 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[pipeline/match] DELETE error:', e)
    return NextResponse.json({
      error: '서버 오류가 발생했습니다.',
      details: e.message || 'Unknown error'
    }, { status: 500 })
  }
}

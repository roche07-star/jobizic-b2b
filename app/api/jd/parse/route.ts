import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getJDParsePrompt } from '@/lib/prompts/base-headhunter'
import { callClaude } from '@/lib/claude-client'

// 📝 JD 분석 결과 타입 정의
interface JDParseResult {
  step1_context: {
    company: string
    industry: string
    position_official: string
    position_actual: string | null
    level: string
    team_structure: string
    hiring_background: string
  }
  step2_requirements: {
    must_have: string[]
    nice_to_have: string[]
    implicit: string[]
  }
  company_analysis: {
    introduction: string
    revenue: string
    current_business: string
    recent_trends: string
    future_value: string
  }
  step3_headhunter_insight: {
    core_profile: string
    caution_points: string[]
    search_direction: string
    interview_prediction: string[]
  }
  step4_client_comment: {
    comment_summary?: string
    changes?: Array<{ before: string; after: string; reason: string }>
    refined_profile?: string
  } | null
  metadata: {
    location: string
    salary: string
    deadline: string
    priority: '긴급' | '중요' | '일반'
    difficulty: '상' | '중' | '하'
  }
}

// 🔧 Tool 정의: JD 분석 결과 구조화
const JD_PARSE_TOOL: Anthropic.Tool = {
  name: 'analyze_job_description',
  description: 'JD를 4단계 프로세스로 분석하여 구조화된 형식으로 반환',
  input_schema: {
    type: 'object',
    properties: {
      step1_context: {
        type: 'object',
        properties: {
          company: { type: 'string', description: '회사명' },
          industry: { type: 'string', description: '산업군' },
          position_official: { type: 'string', description: '공식 포지션명' },
          position_actual: { type: 'string', description: '실질 포지션명 (다를 경우, 같으면 null)' },
          level: { type: 'string', description: '직급 범위 (예: 과장~차장)' },
          team_structure: { type: 'string', description: '팀 구조 설명' },
          hiring_background: { type: 'string', description: '채용 배경 (신규/결원/증원)' }
        },
        required: ['company', 'industry', 'position_official', 'level', 'team_structure', 'hiring_background']
      },
      step2_requirements: {
        type: 'object',
        properties: {
          must_have: { type: 'array', items: { type: 'string' }, description: '필수역량 (없으면 탈락)' },
          nice_to_have: { type: 'array', items: { type: 'string' }, description: '우대역량 (가점)' },
          implicit: { type: 'array', items: { type: 'string' }, description: '숨은 요구역량 (JD에 없지만 필요)' }
        },
        required: ['must_have', 'nice_to_have', 'implicit']
      },
      company_analysis: {
        type: 'object',
        description: '회사 상세 분석 — JD, 회사명, URL에서 알 수 있는 정보 기반. 정보가 불충분하면 "회사 정보 확인 불가"',
        properties: {
          introduction: {
            type: 'string',
            description: '회사 소개 (업종, 주요 사업, 설립 배경 등). 정보가 없으면 "회사 정보 확인 불가"'
          },
          revenue: {
            type: 'string',
            description: '매출액 또는 규모 추정 (알려진 경우). 정보가 없으면 "정보 부족"'
          },
          current_business: {
            type: 'string',
            description: '현재 진행 중인 주요 사업/프로젝트 (JD에서 추론 가능한 경우). 정보가 없으면 "정보 부족"'
          },
          recent_trends: {
            type: 'string',
            description: '최근 동향 (채용 배경, 사업 확장 등 JD에서 유추). 정보가 없으면 "정보 부족"'
          },
          future_value: {
            type: 'string',
            description: '회사 미래 가치 및 성장 가능성 (산업 전망, 경쟁력, 투자 가치 등). 정보가 없으면 "정보 부족"'
          }
        },
        required: ['introduction', 'revenue', 'current_business', 'recent_trends', 'future_value']
      },
      step3_headhunter_insight: {
        type: 'object',
        properties: {
          core_profile: { type: 'string', description: '핵심 1명 프로파일 (구체적 인물상 3-4문장)' },
          caution_points: { type: 'array', items: { type: 'string' }, description: '주의 포인트 (리스크, 함정)' },
          search_direction: { type: 'string', description: '탐색 방향 (어디서 누구를 찾을지 2-3문장)' },
          interview_prediction: { type: 'array', items: { type: 'string' }, description: '예상 면접 포인트' }
        },
        required: ['core_profile', 'caution_points', 'search_direction', 'interview_prediction']
      },
      step4_client_comment: {
        type: 'object',
        properties: {
          comment_summary: { type: 'string', description: '클라이언트 코멘트 요약' },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                before: { type: 'string' },
                after: { type: 'string' },
                reason: { type: 'string' }
              },
              required: ['before', 'after', 'reason']
            },
            description: '변경 사항 목록'
          },
          refined_profile: { type: 'string', description: '보완된 핵심 프로파일' }
        },
        description: '클라이언트 코멘트가 있을 경우만 포함 (없으면 null)'
      },
      metadata: {
        type: 'object',
        properties: {
          location: { type: 'string', description: '근무지' },
          salary: { type: 'string', description: '명시된 연봉' },
          deadline: { type: 'string', description: '마감일' },
          priority: { type: 'string', enum: ['긴급', '중요', '일반'], description: '우선순위' },
          difficulty: { type: 'string', enum: ['상', '중', '하'], description: '난이도' }
        },
        required: ['location', 'salary', 'deadline', 'priority', 'difficulty']
      }
    },
    required: ['step1_context', 'step2_requirements', 'company_analysis', 'step3_headhunter_insight', 'metadata']
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text, company_url, client_comment } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'JD 내용을 입력해 주세요.' }, { status: 400 })

    // 회사 URL이 있으면 웹페이지 정보 가져오기
    let companyWebInfo = ''
    if (company_url?.trim()) {
      try {
        const urlToFetch = company_url.trim()
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000) // 10초 타임아웃

        const response = await fetch(urlToFetch, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        })
        clearTimeout(timeout)

        if (response.ok) {
          const html = await response.text()
          // HTML에서 텍스트만 추출 (간단한 방법)
          const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 3000) // 처음 3000자만

          if (textContent.length > 100) {
            companyWebInfo = `\n\n## 회사 웹사이트 정보 (${company_url}):\n${textContent}`
          }
        }
      } catch (err) {
        console.warn('[jd/parse] Failed to fetch company URL:', err)
        // URL fetch 실패해도 계속 진행
      }
    }

    console.log('[jd/parse] Calling Claude API with Tool Calling...')

    const userContent = client_comment
      ? `다음 JD를 분석하고, 클라이언트 코멘트를 반영하여 분석을 보완해주세요.\n\n## JD:\n${text}${companyWebInfo}\n\n## 클라이언트 코멘트:\n${client_comment}\n\n**step4_client_comment 필드에 다음을 포함:**\n- comment_summary: 코멘트 요약\n- changes: [{"before": "변경 전", "after": "변경 후", "reason": "이유"}]\n- refined_profile: 보완된 핵심 프로파일`
      : `다음 JD를 분석해주세요:\n\n${text}${companyWebInfo}`

    const message = await callClaude({
      max_tokens: 4000,
      system: [{
        type: 'text',
        text: getJDParsePrompt(), // ✨ Enhanced prompt with common rules
        cache_control: { type: 'ephemeral' }
      }],
      tools: [JD_PARSE_TOOL],
      tool_choice: { type: 'tool', name: 'analyze_job_description' },
      messages: [{
        role: 'user',
        content: userContent
      }],
    })

    console.log('[jd/parse] ✅ Claude API response received')

    // 📊 Prompt Caching Usage 로깅
    if (message.usage) {
      console.log('[jd/parse] 💰 Token Usage:', {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        cache_creation_input_tokens: message.usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: message.usage.cache_read_input_tokens || 0
      })

      const cacheHitRate = message.usage.cache_read_input_tokens
        ? (message.usage.cache_read_input_tokens / (message.usage.input_tokens + message.usage.cache_read_input_tokens) * 100).toFixed(1)
        : 0
      console.log('[jd/parse] 📈 Cache Hit Rate:', `${cacheHitRate}%`)
    }

    // 🎯 Tool Use 블록 추출
    const toolUseBlock = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')

    if (!toolUseBlock) {
      console.error('[jd/parse] ❌ No tool_use block found')
      return NextResponse.json({ error: '파싱 실패. 다시 시도해 주세요.' }, { status: 500 })
    }

    const parsed = toolUseBlock.input as JDParseResult
    console.log('[jd/parse] ✅ Tool use extracted successfully')

    // 🔧 VARCHAR(100) 제한 필드 자르기 (DB 에러 방지)
    const truncate = (str: string | null, maxLength: number = 100): string | null => {
      if (!str) return str
      if (str.length > maxLength) {
        console.warn(`[jd/parse] ⚠️ Truncating field (${str.length} → ${maxLength}):`, str.substring(0, 50) + '...')
      }
      return str.length > maxLength ? str.substring(0, maxLength) : str
    }

    // Backward compatibility: 이전 구조도 함께 반환
    const legacy = {
      company: truncate(parsed.step1_context?.company || null, 100),
      position: truncate(parsed.step1_context?.position_official || parsed.step1_context?.position_actual || '포지션명', 100),
      location: truncate(parsed.metadata?.location || null, 100),
      salary: parsed.metadata?.salary || null,
      deadline: parsed.metadata?.deadline || 'ASAP',
      keywords: [
        ...(parsed.step2_requirements?.must_have || []).slice(0, 3),
        ...(parsed.step2_requirements?.nice_to_have || []).slice(0, 2)
      ],
      required_skills: parsed.step2_requirements?.must_have || [],
      preferred_skills: parsed.step2_requirements?.nice_to_have || [],
      priority: parsed.metadata?.priority || '일반',
      difficulty: parsed.metadata?.difficulty || '중',
      difficulty_reason: `난이도 ${parsed.metadata?.difficulty || '중'}`,
      target_profile: parsed.step3_headhunter_insight?.core_profile || '',
      search_strategy: parsed.step3_headhunter_insight?.search_direction || '',
      salary_estimate: parsed.metadata?.salary || '협의',
      key_points: parsed.step3_headhunter_insight?.caution_points || []
    }

    return NextResponse.json({
      ...legacy,
      _v2: parsed // 새 구조는 _v2에 저장
    })
  } catch (e: any) {
    console.error('[jd/parse] ❌❌❌ FATAL ERROR ❌❌❌')
    console.error('[jd/parse] Error name:', e.name)
    console.error('[jd/parse] Error message:', e.message)
    console.error('[jd/parse] Error stack:', e.stack)

    // Anthropic API 에러 상세 정보
    if (e.status) {
      console.error('[jd/parse] Anthropic API status:', e.status)
      console.error('[jd/parse] Anthropic API error:', e.error)
    }

    return NextResponse.json({
      error: '서버 오류가 발생했습니다.',
      details: e.message || 'Unknown error'
    }, { status: 500 })
  }
}

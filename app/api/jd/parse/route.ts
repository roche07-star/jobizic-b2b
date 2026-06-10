import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getJDParsePrompt } from '@/lib/prompts/base-headhunter'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    required: ['step1_context', 'step2_requirements', 'step3_headhunter_insight', 'metadata']
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text, client_comment } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'JD 내용을 입력해 주세요.' }, { status: 400 })

    console.log('[jd/parse] Calling Claude API with Tool Calling...')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
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
        content: client_comment
          ? `다음 JD를 분석하고, 클라이언트 코멘트를 반영하여 분석을 보완해주세요.\n\n## JD:\n${text}\n\n## 클라이언트 코멘트:\n${client_comment}\n\n**step4_client_comment 필드에 다음을 포함:**\n- comment_summary: 코멘트 요약\n- changes: [{"before": "변경 전", "after": "변경 후", "reason": "이유"}]\n- refined_profile: 보완된 핵심 프로파일`
          : `다음 JD를 분석해주세요:\n\n${text}`
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

    // Backward compatibility: 이전 구조도 함께 반환
    const legacy = {
      company: parsed.step1_context?.company || null,
      position: parsed.step1_context?.position_official || parsed.step1_context?.position_actual || '포지션명',
      location: parsed.metadata?.location || null,
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

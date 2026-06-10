import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getJDParsePrompt } from '@/lib/prompts/base-headhunter'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { text, client_comment } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'JD 내용을 입력해 주세요.' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: [{
        type: 'text',
        text: getJDParsePrompt(), // ✨ Enhanced prompt with common rules
        cache_control: { type: 'ephemeral' }
      }],
      messages: [{
        role: 'user',
        content: client_comment
          ? `다음 JD를 분석하고, 클라이언트 코멘트를 반영하여 분석을 보완해주세요.\n\n## JD:\n${text}\n\n## 클라이언트 코멘트:\n${client_comment}\n\n**step4_client_comment 필드에 다음을 포함:**\n- comment_summary: 코멘트 요약\n- changes: [{"before": "변경 전", "after": "변경 후", "reason": "이유"}]\n- refined_profile: 보완된 핵심 프로파일`
          : `다음 JD를 분석해주세요:\n\n${text}`
      }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: '파싱 실패. 다시 시도해 주세요.' }, { status: 500 })

    const parsed = JSON.parse(match[0])

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
  } catch (e) {
    console.error('[jd/parse]', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

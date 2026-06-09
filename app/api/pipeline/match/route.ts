import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { jd, candidate } = await req.json()
    if (!jd || !candidate) {
      return NextResponse.json({ error: 'JD와 후보자 정보가 필요합니다.' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: [{
        type: 'text',
        text: `당신은 10년 경력의 전문 헤드헌터입니다. 주어진 JD와 후보자 정보를 분석하여 매칭 점수와 근거를 제공하세요. 아래 JSON 형식으로만 응답하세요. 설명 없이 JSON만 출력하세요.

{
  "match_score": 0-100점수,
  "match_reason": "매칭 근거 2~3문장",
  "skill_match_rate": 0-100,
  "experience_match": "경력 적합도 평가 2문장",
  "strength_for_jd": ["이 JD에 대한 후보자 강점1", "강점2", "강점3"],
  "concerns": ["우려사항1", "우려사항2"],
  "recommendation": "추천|보류|부적합",
  "next_steps": "다음 단계 제안 (예: 1차 면접 추천, 추가 검토 필요 등)"
}`,
        cache_control: { type: 'ephemeral' }
      }],
      messages: [{
        role: 'user',
        content: `다음 JD와 후보자의 적합도를 분석해주세요:

【JD 정보】
- 회사: ${jd.company ?? '미상'}
- 포지션: ${jd.position}
- 필수 스킬: ${jd.required_skills?.join(', ') ?? '없음'}
- 우대 스킬: ${jd.preferred_skills?.join(', ') ?? '없음'}
- 난이도: ${jd.difficulty}
- 타깃 프로파일: ${jd.target_profile ?? '없음'}

【후보자 정보】
🔒 개인정보 보호: 이름, 회사명 등 개인정보는 제외됨
- 현재 포지션: ${candidate.current_position ?? '미상'}
- 경력: ${candidate.total_experience_years ? `${candidate.total_experience_years}년` : '미상'}
- 스킬: ${candidate.skills?.join(', ') ?? '없음'}
- 기술스택: ${candidate.tech_stack?.join(', ') ?? '없음'}
- 강점 요약: ${candidate.strength_summary ?? '없음'}
- 커리어 방향: ${candidate.career_trajectory ?? '없음'}
`
      }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: '매칭 분석 실패. 다시 시도해 주세요.' }, { status: 500 })

    const result = JSON.parse(match[0])
    return NextResponse.json(result)
  } catch (e) {
    console.error('[pipeline/match]', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

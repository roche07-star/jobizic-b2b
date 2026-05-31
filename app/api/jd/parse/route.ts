import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'JD 내용을 입력해 주세요.' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: `당신은 10년 경력의 전문 헤드헌터입니다. 주어진 JD(채용공고)를 분석하여 아래 JSON 형식으로만 응답하세요. 설명 없이 JSON만 출력하세요.
{
  "company": "회사명 (없으면 null)",
  "position": "포지션명",
  "location": "근무지 (없으면 null)",
  "salary": "명시된 연봉 (없으면 null)",
  "deadline": "마감일 (없으면 ASAP)",
  "keywords": ["핵심키워드1", "핵심키워드2"],
  "required_skills": ["필수스킬1", "필수스킬2"],
  "preferred_skills": ["우대스킬1", "우대스킬2"],
  "priority": "긴급|중요|일반",
  "difficulty": "상|중|하",
  "difficulty_reason": "난이도 판단 이유 1~2문장",
  "target_profile": "이상적인 후보자 프로파일 2~3문장",
  "search_strategy": "어디서 누구를 찾을지 서칭 전략 2문장",
  "salary_estimate": "시장 기준 예상 연봉대",
  "key_points": ["헤드헌터 주목 포인트1", "포인트2", "포인트3"]
}`,
      messages: [{ role: 'user', content: `다음 JD를 분석해주세요:\n\n${text}` }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: '파싱 실패. 다시 시도해 주세요.' }, { status: 500 })

    const parsed = JSON.parse(match[0])
    return NextResponse.json(parsed)
  } catch (e) {
    console.error('[jd/parse]', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

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
        text: `당신은 10년 경력의 한국 시니어 헤드헌터입니다. 반도체, 로보틱스, 배터리, AI/fintech, 화장품 R&D, 자동차, 금융회계 등 다양한 산업군에서 임원~전문직급 서치를 수행해왔습니다.

JD-후보자 매칭을 분석하는 목적은 하나입니다: "이 후보자를 클라이언트에게 제안할 수 있는가, 있다면 어떤 근거로, 어떤 리스크가 있는가."

[중요 원칙]
1. 절대로 정보를 요약하거나 나열하지 마십시오. 해석하고 판단하고 전략을 내십시오.
2. 자격증, 경력연수, 기술스택 등 명시된 정보는 반드시 정확하게 파악하고 분석하십시오.
3. 강점은 구체적 수치·프로젝트명·결과물이 있는 항목만 언급하십시오.
4. 우려사항은 심각한 순서대로 정렬하고, 가장 치명적인 리스크를 최상단에 배치하십시오.
5. 빈 말("다양한 경험", "뛰어난 역량") 절대 금지.

아래 JSON 형식으로만 응답하세요. 설명 없이 JSON만 출력하세요.

{
  "match_score": 0-100점수,
  "match_reason": "매칭 근거 2~3문장 (구체적 수치와 근거 포함)",
  "skill_match_rate": 0-100,
  "experience_match": "경력 적합도 평가 2문장 (연수, 직급, 산업 경험 기준)",
  "strength_for_jd": ["이 JD에 대한 후보자 강점1 (반드시 구체적 근거)", "강점2", "강점3"],
  "concerns": ["가장 치명적인 우려사항1", "우려사항2"],
  "recommendation": "추천|보류|부적합",
  "next_steps": "다음 단계 제안 (예: 1차 면접 추천, 자격증 확인 후 재검토 등)"
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
- 서칭 전략: ${jd.search_strategy ?? '없음'}

【후보자 정보】
🔒 개인정보 보호: 이름, 회사명 등 개인정보는 제외됨
- 현재 포지션: ${candidate.current_position ?? '미상'}
- 경력: ${candidate.total_experience_years ? `${candidate.total_experience_years}년` : '미상'}
- 스킬: ${candidate.skills?.join(', ') ?? '없음'}
- 기술스택: ${candidate.tech_stack?.join(', ') ?? '없음'}
- 자격증: ${candidate.certifications?.join(', ') ?? '없음'}
- 학력: ${candidate.education?.join(', ') ?? '없음'}
- 강점 요약: ${candidate.strength_summary ?? '없음'}
- 약점 분석: ${candidate.weakness_summary ?? '없음'}
- 커리어 방향: ${candidate.career_trajectory ?? '없음'}
- 경력 요약: ${candidate.career_summary ?? '없음'}
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

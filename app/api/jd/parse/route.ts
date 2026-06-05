import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { text, client_comment } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'JD 내용을 입력해 주세요.' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `당신은 10년 경력의 전문 헤드헌터입니다. JD를 4단계 프로세스로 분석하여 JSON 형식으로 응답하세요.

## 분석 프로세스 4단계

**Step 1 — 포지션 컨텍스트**
- 회사/산업군
- 포지션명 (공식 vs 실질)
- 직급 범위
- 팀 구조
- 채용 배경

**Step 2 — 요구 역량 3분류**
- 필수 (Must-have): 없으면 서류 탈락
- 우대 (Nice-to-have): 있으면 가점
- 숨은 요구역량 (Implicit): JD에 명시 안 됐지만 실제 필요한 역량

**Step 3 — 헤드헌터 해석**
- 핵심 1명 프로파일 (구체적 인물상)
- 주의 포인트 (리스크, 함정)
- 탐색 방향 (어디서 찾을지)
- 면접 포인트 예측

**Step 4 — 클라이언트 코멘트 반영 (선택)**
코멘트가 있을 경우만:
- 요건 완화/강화
- 우선순위 변경
- 숨은 맥락 파악
- 기피 프로파일
- 처우 조건

## 하지 말 것
❌ JD 그대로 복사·나열
❌ 필수·우대 구분 없이 나열
❌ "좋은 회사입니다" 같은 빈 말
❌ 비현실적 요구를 검증 없이 수용
❌ 코멘트 있는데 기본 출력만 제공

## JSON 출력 형식
{
  "step1_context": {
    "company": "회사명",
    "industry": "산업군",
    "position_official": "공식 포지션명",
    "position_actual": "실질 포지션명 (다를 경우)",
    "level": "직급 범위 (예: 과장~차장)",
    "team_structure": "팀 구조 설명",
    "hiring_background": "채용 배경 (신규/결원/증원)"
  },
  "step2_requirements": {
    "must_have": ["필수역량1", "필수역량2"],
    "nice_to_have": ["우대역량1", "우대역량2"],
    "implicit": ["숨은요구역량1", "숨은요구역량2"]
  },
  "step3_headhunter_insight": {
    "core_profile": "핵심 1명 프로파일 (구체적 인물상 3-4문장)",
    "caution_points": ["주의포인트1", "주의포인트2"],
    "search_direction": "탐색 방향 (어디서 누구를 찾을지 2-3문장)",
    "interview_prediction": ["예상 면접 포인트1", "포인트2"]
  },
  "step4_client_comment": null,
  "metadata": {
    "location": "근무지",
    "salary": "명시된 연봉",
    "deadline": "마감일",
    "priority": "긴급|중요|일반",
    "difficulty": "상|중|하"
  }
}

**중요**: 설명 없이 JSON만 출력하세요.`,
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
    return NextResponse.json(parsed)
  } catch (e) {
    console.error('[jd/parse]', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

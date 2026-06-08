import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text?.trim()) {
      console.error('[candidates/parse] Empty text received')
      return NextResponse.json({ error: '이력서 내용을 입력해 주세요.' }, { status: 400 })
    }

    console.log('[candidates/parse] Calling Claude API...')
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: [{
        type: 'text',
        text: `당신은 10년 경력의 전문 헤드헌터입니다. 주어진 이력서를 분석하여 아래 JSON 형식으로만 응답하세요. 설명 없이 JSON만 출력하세요.
{
  "name": "이름",
  "email": "이메일 (없으면 null)",
  "phone": "전화번호 (없으면 null)",
  "location": "거주지 (없으면 null)",
  "current_company": "현재 회사 (없으면 null)",
  "current_position": "현재 직급/포지션 (없으면 null)",
  "total_experience_years": 총경력년수숫자,
  "career_summary": "경력 요약 2~3문장",
  "education": ["학력1", "학력2"],
  "skills": ["스킬1", "스킬2", "스킬3"],
  "tech_stack": ["기술스택1", "기술스택2"],
  "certifications": ["자격증1", "자격증2"],
  "languages": ["한국어(원어민)", "영어(비즈니스)", "일본어(기초)"],
  "desired_position": "희망 포지션 (없으면 null)",
  "desired_salary": "희망 연봉 (없으면 null)",
  "desired_location": "희망 근무지 (없으면 null)",
  "job_search_status": "적극적|관심있음|잠재적",
  "strength_summary": "강점 요약 2~3문장",
  "career_trajectory": "커리어 방향성 및 성장 궤적 2~3문장",
  "ideal_roles": ["적합한포지션1", "적합한포지션2", "적합한포지션3"],
  "market_value": "시장가치 예상 연봉대",
  "key_highlights": ["하이라이트1", "하이라이트2", "하이라이트3"],
  "tags": ["태그1", "태그2", "태그3"]
}`,
        cache_control: { type: 'ephemeral' }
      }],
      messages: [{ role: 'user', content: `다음 이력서를 분석해주세요:\n\n${text}` }],
    })

    console.log('[candidates/parse] Claude API response received')

    // Content 검증
    if (!message.content || message.content.length === 0) {
      console.error('[candidates/parse] Empty content from Claude')
      return NextResponse.json({ error: 'AI 응답이 비어있습니다.' }, { status: 500 })
    }

    const firstContent = message.content[0]
    if (firstContent.type !== 'text') {
      console.error('[candidates/parse] Unexpected content type:', firstContent.type)
      return NextResponse.json({ error: 'AI 응답 형식 오류.' }, { status: 500 })
    }

    const raw = firstContent.text
    console.log('[candidates/parse] Raw response:', raw.substring(0, 100) + '...')

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[candidates/parse] JSON not found in response:', raw)
      return NextResponse.json({ error: '파싱 실패. 다시 시도해 주세요.' }, { status: 500 })
    }

    const parsed = JSON.parse(match[0])
    console.log('[candidates/parse] Successfully parsed:', Object.keys(parsed))
    return NextResponse.json(parsed)
  } catch (e: any) {
    console.error('[candidates/parse] Error:', e)
    console.error('[candidates/parse] Error name:', e.name)
    console.error('[candidates/parse] Error message:', e.message)
    console.error('[candidates/parse] Error stack:', e.stack)

    // Anthropic API 에러 상세 정보
    if (e.status) {
      console.error('[candidates/parse] API status:', e.status)
      console.error('[candidates/parse] API error:', e.error)
    }

    return NextResponse.json({
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? e.message : undefined
    }, { status: 500 })
  }
}

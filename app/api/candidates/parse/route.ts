import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 개인정보 추출 함수
function extractPersonalInfo(text: string): {
  name: string | null
  email: string | null
  phone: string | null
  birth_year: number | null
  location: string | null
} {
  // 이메일 추출
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  const email = emailMatch ? emailMatch[0] : null

  // 전화번호 추출 (첫 번째 것만)
  const phoneMatch = text.match(/(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})|(\+82[-\s]?\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4})/)
  const phone = phoneMatch ? phoneMatch[0] : null

  // 이름 추출 (간단한 패턴: 이력서 상단의 한글 2-4자)
  const nameMatch = text.match(/^[\s\n]*([가-힣]{2,4})[\s\n]/m)
  const name = nameMatch ? nameMatch[1] : null

  // 출생년도 추출
  let birth_year: number | null = null
  // 패턴 1: "생년월일: 1990.01.01" 또는 "1990-01-01"
  const birthDateMatch = text.match(/(생년월일|생일|DOB|Birth)[\s:：]*(\d{4})[-./]?\d{1,2}[-./]?\d{1,2}/i)
  if (birthDateMatch) {
    birth_year = parseInt(birthDateMatch[2])
  } else {
    // 패턴 2: "1990년생" 또는 "90년생"
    const yearMatch = text.match(/(\d{4}|\d{2})년생/)
    if (yearMatch) {
      let year = parseInt(yearMatch[1])
      if (year < 100) year += year < 50 ? 2000 : 1900 // 2자리 년도 처리
      birth_year = year
    } else {
      // 패턴 3: "만 33세" 에서 역산
      const ageMatch = text.match(/만\s*(\d{1,2})세/)
      if (ageMatch) {
        const age = parseInt(ageMatch[1])
        birth_year = new Date().getFullYear() - age
      }
    }
  }

  // 주소 추출 (첫 번째 것만)
  const locationMatch = text.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(특별시|광역시|특별자치시|도|특별자치도)?[가-힣0-9\s-]+/)
  const location = locationMatch ? locationMatch[0].trim() : null

  return { name, email, phone, birth_year, location }
}

// 개인정보 마스킹 함수
function maskPersonalInfo(text: string): string {
  // 이메일 마스킹
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
  // 전화번호 마스킹 (한국 형식)
  text = text.replace(/(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})/g, '[PHONE]')
  text = text.replace(/(\+82[-\s]?\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4})/g, '[PHONE]')
  // 생년월일 마스킹
  text = text.replace(/(생년월일|생일|DOB|Birth)[\s:：]*\d{4}[-./]?\d{1,2}[-./]?\d{1,2}/gi, '[BIRTHDATE]')
  text = text.replace(/\d{4}년생/g, '[BIRTHYEAR]')
  text = text.replace(/만\s*\d{1,2}세/g, '[AGE]')
  // 주소 마스킹 (시/도, 시/군/구 포함)
  text = text.replace(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(특별시|광역시|특별자치시|도|특별자치도)?\s*[가-힣0-9\s-]+/g, '[ADDRESS]')
  return text
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text?.trim()) {
      console.error('[candidates/parse] Empty text received')
      return NextResponse.json({ error: '이력서 내용을 입력해 주세요.' }, { status: 400 })
    }

    // 🔒 개인정보 추출 (Claude에 보내지 않음)
    const personalInfo = extractPersonalInfo(text)
    console.log('[candidates/parse] Personal info extracted:', {
      hasName: !!personalInfo.name,
      hasEmail: !!personalInfo.email,
      hasPhone: !!personalInfo.phone
    })

    // 🔒 개인정보 마스킹
    const maskedText = maskPersonalInfo(text)
    console.log('[candidates/parse] Personal info masked. Calling Claude API...')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: [{
        type: 'text',
        text: `당신은 10년 경력의 전문 헤드헌터입니다. 주어진 이력서를 분석하여 아래 JSON 형식으로만 응답하세요. 설명 없이 JSON만 출력하세요.
⚠️ 개인정보(이름, 이메일, 전화번호, 생년월일, 주소)는 [EMAIL], [PHONE], [BIRTHDATE], [BIRTHYEAR], [AGE], [ADDRESS]로 마스킹되어 있으므로 null로 반환하세요.
{
  "name": null,
  "email": null,
  "phone": null,
  "birth_year": null,
  "location": null,
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
  "weakness_summary": "약점 또는 보완 필요 영역 2~3문장",
  "career_trajectory": "커리어 방향성 및 성장 궤적 2~3문장",
  "ideal_roles": ["적합한포지션1", "적합한포지션2", "적합한포지션3"],
  "market_value": "시장가치 예상 연봉대",
  "key_highlights": ["하이라이트1", "하이라이트2", "하이라이트3"],
  "tags": ["태그1", "태그2", "태그3"]
}`,
        cache_control: { type: 'ephemeral' }
      }],
      messages: [{ role: 'user', content: `다음 이력서를 분석해주세요:\n\n${maskedText}` }],
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
    console.log('[candidates/parse] Raw response length:', raw.length)
    console.log('[candidates/parse] Raw response preview:', raw.substring(0, 200) + '...')

    // JSON 추출 개선: 첫 번째 { 부터 마지막 } 까지 (greedy → non-greedy)
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('[candidates/parse] No JSON braces found in response')
      return NextResponse.json({ error: '파싱 실패. 다시 시도해 주세요.' }, { status: 500 })
    }

    const jsonStr = raw.substring(jsonStart, jsonEnd + 1)
    console.log('[candidates/parse] Extracted JSON length:', jsonStr.length)

    const match = jsonStr.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[candidates/parse] JSON not found in response:', raw)
      return NextResponse.json({ error: '파싱 실패. 다시 시도해 주세요.' }, { status: 500 })
    }

    const parsed = JSON.parse(match[0])
    console.log('[candidates/parse] Successfully parsed:', Object.keys(parsed))

    // ✅ 추출한 개인정보를 Claude 응답과 합치기
    const result = {
      ...parsed,
      name: personalInfo.name || parsed.name,
      email: personalInfo.email || parsed.email,
      phone: personalInfo.phone || parsed.phone,
      birth_year: personalInfo.birth_year || parsed.birth_year,
      location: personalInfo.location || parsed.location,
    }

    console.log('[candidates/parse] Final result with personal info:', {
      hasName: !!result.name,
      hasEmail: !!result.email,
      hasPhone: !!result.phone,
      hasBirthYear: !!result.birth_year
    })

    return NextResponse.json(result)
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

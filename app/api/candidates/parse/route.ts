import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCandidateParsePrompt } from '@/lib/prompts/base-headhunter'

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

  // 이름 추출
  let name: string | null = null

  // 패턴 1: "성명:", "이름:", "Name:" 등의 레이블 다음에 오는 이름
  const labeledNameMatch = text.match(/(성명|이름|성\s*명|Name|NAME)[\s:：]+([가-힣]{2,4}|[A-Z][a-z]+\s[A-Z][a-z]+)/i)
  if (labeledNameMatch) {
    name = labeledNameMatch[2].trim()
  } else {
    // 패턴 2: 이력서 상단의 한글 2-4자 (fallback)
    const simpleNameMatch = text.match(/^[\s\n]*([가-힣]{2,4})[\s\n]/m)
    if (simpleNameMatch) {
      name = simpleNameMatch[1]
    }
  }

  // 출생년도 추출
  let birth_year: number | null = null
  // 패턴 1: "생년월일: 1990.01.01" 또는 "1990-01-01"
  const birthDateMatch = text.match(/(생년월일|생일|DOB|Birth)[\s:：]*(\d{4})[-./]?\d{1,2}[-./]?\d{1,2}/i)
  if (birthDateMatch) {
    birth_year = parseInt(birthDateMatch[2])
  } else {
    // 패턴 2: "1990년생" 또는 "90년생" 또는 "출생: 1990년"
    const yearMatch = text.match(/(출생|생년|태어난)[\s:：]*(\d{4}|\d{2})년?|(\d{4}|\d{2})년생/i)
    if (yearMatch) {
      const year = yearMatch[2] || yearMatch[3]
      let birthYear = parseInt(year)
      if (birthYear < 100) birthYear += birthYear < 50 ? 2000 : 1900 // 2자리 년도 처리
      // 유효 범위 검증 (1940-2020년)
      if (birthYear >= 1940 && birthYear <= 2020) {
        birth_year = birthYear
      }
    } else {
      // 패턴 3: "만 33세" 에서 역산
      const ageMatch = text.match(/만\s*(\d{1,2})세/)
      if (ageMatch) {
        const age = parseInt(ageMatch[1])
        birth_year = new Date().getFullYear() - age
      }
    }
  }

  // 주소 추출 (시/도 + 구/군 정도만, 최대 20자)
  const locationMatch = text.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(특별시|광역시|특별자치시|도|특별자치도)?\s*[가-힣]{1,10}[구군시]?/)
  let location = locationMatch ? locationMatch[0].trim() : null

  // 불필요한 단어 제거 (기본정보, 학력 등)
  if (location) {
    location = location.replace(/(기본정보|학력|자격증|경력).*$/, '').trim()
    // 너무 길면 자르기 (20자 제한)
    if (location.length > 20) {
      location = location.substring(0, 20)
    }
  }

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
  // 주소 마스킹 (시/도 + 구/군 정도만)
  text = text.replace(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(특별시|광역시|특별자치시|도|특별자치도)?\s*[가-힣]{1,10}[구군시]?/g, '[ADDRESS]')
  return text
}

export async function POST(req: NextRequest) {
  try {
    let resumeText: string

    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // 파일 업로드
      const formData = await req.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json({ error: '파일을 업로드해 주세요.' }, { status: 400 })
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })
      }

      const { extractText } = await import('@/lib/extractText')
      const buffer = Buffer.from(await file.arrayBuffer())

      try {
        resumeText = await extractText(buffer, file.name)
      } catch (e) {
        const msg = e instanceof Error ? e.message : '파일을 읽을 수 없습니다.'
        return NextResponse.json({ error: msg }, { status: 422 })
      }
    } else {
      // 텍스트 입력
      const { text } = await req.json()
      resumeText = text
    }

    if (!resumeText?.trim()) {
      console.error('[candidates/parse] Empty text received')
      return NextResponse.json({ error: '이력서 내용을 입력해 주세요.' }, { status: 400 })
    }

    // 🔒 개인정보 추출 (Claude에 보내지 않음)
    const personalInfo = extractPersonalInfo(resumeText)
    console.log('[candidates/parse] Personal info extracted:', {
      hasName: !!personalInfo.name,
      hasEmail: !!personalInfo.email,
      hasPhone: !!personalInfo.phone
    })

    // 🔒 개인정보 마스킹
    const maskedText = maskPersonalInfo(resumeText)
    console.log('[candidates/parse] Personal info masked. Calling Claude API...')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: [{
        type: 'text',
        text: getCandidateParsePrompt(), // ✨ Enhanced prompt from ADAM
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

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCandidateParsePrompt } from '@/lib/prompts/base-headhunter'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 📝 후보자 분석 결과 타입 정의
interface CandidateParseResult {
  name: string | null
  email: string | null
  phone: string | null
  birth_year: number | null
  location: string | null
  current_company: string | null
  current_position: string | null
  total_experience_years: number
  career_summary: string
  education: string[]
  skills: string[]
  tech_stack: string[]
  certifications: string[]
  languages: string[]
  desired_position: string | null
  desired_salary: string | null
  desired_location: string | null
  job_search_status: '적극적' | '관심있음' | '잠재적'
  strength_summary: string
  weakness_summary: string
  career_trajectory: string
  ideal_roles: string[]
  market_value: string
  key_highlights: string[]
  tags: string[]
}

// 🔧 Tool 정의: 후보자 분석 결과 구조화
const CANDIDATE_PARSE_TOOL: Anthropic.Tool = {
  name: 'analyze_candidate_resume',
  description: '후보자 이력서를 분석하여 구조화된 형식으로 반환',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '이름 (마스킹되어 null)' },
      email: { type: 'string', description: '이메일 (마스킹되어 null)' },
      phone: { type: 'string', description: '전화번호 (마스킹되어 null)' },
      birth_year: { type: 'number', description: '출생연도 (마스킹되어 null)' },
      location: { type: 'string', description: '거주지 (마스킹되어 null)' },
      current_company: { type: 'string', description: '현재 회사 (없으면 null)' },
      current_position: { type: 'string', description: '현재 직급/포지션 (없으면 null)' },
      total_experience_years: { type: 'number', description: '총 경력 년수' },
      career_summary: { type: 'string', description: '경력 요약 2-3문장 (구체적 수치와 프로젝트 포함)' },
      education: { type: 'array', items: { type: 'string' }, description: '학력 (최종학력부터)' },
      skills: { type: 'array', items: { type: 'string' }, description: '스킬 목록' },
      tech_stack: { type: 'array', items: { type: 'string' }, description: '기술스택' },
      certifications: { type: 'array', items: { type: 'string' }, description: '자격증' },
      languages: { type: 'array', items: { type: 'string' }, description: '언어 능력' },
      desired_position: { type: 'string', description: '희망 포지션 (없으면 null)' },
      desired_salary: { type: 'string', description: '희망 연봉 (없으면 null)' },
      desired_location: { type: 'string', description: '희망 근무지 (없으면 null)' },
      job_search_status: { type: 'string', enum: ['적극적', '관심있음', '잠재적'], description: '구직 상태' },
      strength_summary: { type: 'string', description: '강점 요약 2-3문장 (구체적 수치, 프로젝트명, 결과물 포함)' },
      weakness_summary: { type: 'string', description: '약점 또는 보완 필요 영역 2-3문장 (심각한 순서대로)' },
      career_trajectory: { type: 'string', description: '커리어 방향성 및 성장 궤적 2-3문장' },
      ideal_roles: { type: 'array', items: { type: 'string' }, description: '적합한 포지션 목록' },
      market_value: { type: 'string', description: '시장가치 예상 연봉대' },
      key_highlights: { type: 'array', items: { type: 'string' }, description: '핵심 하이라이트 (구체적 수치 포함)' },
      tags: { type: 'array', items: { type: 'string' }, description: '태그' }
    },
    required: ['total_experience_years', 'career_summary', 'education', 'skills', 'tech_stack', 'certifications', 'languages', 'job_search_status', 'strength_summary', 'weakness_summary', 'career_trajectory', 'ideal_roles', 'market_value', 'key_highlights', 'tags']
  }
}

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

    console.log('[candidates/parse] Calling Claude API with Tool Calling...')

    // 현재 날짜 (경력 계산용)
    const today = new Date()
    const currentDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: [{
        type: 'text',
        text: getCandidateParsePrompt(), // ✨ Enhanced prompt from ADAM
        cache_control: { type: 'ephemeral' }
      }],
      tools: [CANDIDATE_PARSE_TOOL],
      tool_choice: { type: 'tool', name: 'analyze_candidate_resume' },
      messages: [{
        role: 'user',
        content: `**중요: 오늘은 ${currentDate}입니다. 경력 기간 계산 시 이 날짜를 기준으로 정확히 계산해주세요. 예: 2023년 10월 ~ 현재 = 약 2년 8개월**\n\n다음 이력서를 분석해주세요:\n\n${maskedText}`
      }],
    })

    console.log('[candidates/parse] ✅ Claude API response received')

    // 📊 Prompt Caching Usage 로깅
    if (message.usage) {
      console.log('[candidates/parse] 💰 Token Usage:', {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        cache_creation_input_tokens: message.usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: message.usage.cache_read_input_tokens || 0
      })

      const cacheHitRate = message.usage.cache_read_input_tokens
        ? (message.usage.cache_read_input_tokens / (message.usage.input_tokens + message.usage.cache_read_input_tokens) * 100).toFixed(1)
        : 0
      console.log('[candidates/parse] 📈 Cache Hit Rate:', `${cacheHitRate}%`)
    }

    // 🎯 Tool Use 블록 추출
    const toolUseBlock = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')

    if (!toolUseBlock) {
      console.error('[candidates/parse] ❌ No tool_use block found')
      return NextResponse.json({ error: '파싱 실패. 다시 시도해 주세요.' }, { status: 500 })
    }

    const parsed = toolUseBlock.input as CandidateParseResult
    console.log('[candidates/parse] ✅ Tool use extracted successfully')
    console.log('[candidates/parse] Parsed fields:', Object.keys(parsed))

    // 🔧 VARCHAR(100) 제한 필드 자르기 (DB 에러 방지)
    const truncate = (str: string | null, maxLength: number = 100): string | null => {
      if (!str) return str
      if (str.length > maxLength) {
        console.warn(`[candidates/parse] ⚠️ Truncating field (${str.length} → ${maxLength}):`, str.substring(0, 50) + '...')
      }
      return str.length > maxLength ? str.substring(0, maxLength) : str
    }

    // ✅ 추출한 개인정보를 Claude 응답과 합치기
    const result = {
      ...parsed,
      name: personalInfo.name || parsed.name,
      email: personalInfo.email || parsed.email,
      phone: personalInfo.phone || parsed.phone,
      birth_year: personalInfo.birth_year || parsed.birth_year,
      location: truncate(personalInfo.location || parsed.location, 100),
      // VARCHAR(100) 제한 필드들
      current_company: truncate(parsed.current_company, 100),
      current_position: truncate(parsed.current_position, 100),
      desired_position: truncate(parsed.desired_position, 100),
      desired_location: truncate(parsed.desired_location, 100),
    }

    console.log('[candidates/parse] Final result with personal info:', {
      hasName: !!result.name,
      hasEmail: !!result.email,
      hasPhone: !!result.phone,
      hasBirthYear: !!result.birth_year
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[candidates/parse] ❌❌❌ FATAL ERROR ❌❌❌')
    console.error('[candidates/parse] Error name:', e.name)
    console.error('[candidates/parse] Error message:', e.message)
    console.error('[candidates/parse] Error stack:', e.stack)

    // Anthropic API 에러 상세 정보
    if (e.status) {
      console.error('[candidates/parse] Anthropic API status:', e.status)
      console.error('[candidates/parse] Anthropic API error:', e.error)
    }

    return NextResponse.json({
      error: '서버 오류가 발생했습니다.',
      details: e.message || 'Unknown error'
    }, { status: 500 })
  }
}

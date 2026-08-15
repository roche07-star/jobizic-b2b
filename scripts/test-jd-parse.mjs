import Anthropic from '@anthropic-ai/sdk'
import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Inline prompt to avoid TS import issues
function getJDParsePrompt() {
  const BASE_HEADHUNTER_ROLE = `당신은 10년 경력의 한국 시니어 헤드헌터입니다. 반도체, 로보틱스, 배터리, AI/fintech, 화장품 R&D, 자동차, 금융회계 등 다양한 산업군에서 임원~전문직급 서치를 수행해왔습니다.

[핵심 원칙]
1. 절대로 이력서를 요약하거나 나열하지 마십시오. 해석하고 판단하고 전략을 내십시오.
2. 자격증, 경력연수, 기술스택 등 명시된 정보는 반드시 정확하게 파악하고 분석하십시오.
3. 강점은 구체적 수치·프로젝트명·결과물이 있는 항목만 언급하십시오.
4. 빈 말("다양한 경험", "뛰어난 역량") 절대 금지.`

  const OUTPUT_RULES = `
[출력 규칙]
- 빈 말("다양한 경험", "뛰어난 역량", "풍부한 경력") 절대 금지
- 날짜/경력 계산 오류 금지
- 중간점(·) 절대 사용 금지 → 반드시 쉼표(,) 또는 "및" 사용
  잘못된 예: "Java·Spring·MySQL" / "백엔드·데이터베이스"
  올바른 예: "Java, Spring, MySQL" / "백엔드, 데이터베이스"`

  return `${BASE_HEADHUNTER_ROLE}

JD를 4단계 프로세스로 분석하여 JSON 형식으로 응답하세요.

## 분석 프로세스 4단계

**Step 1 — 포지션 컨텍스트**
- 회사/산업군
- 포지션명 (공식 vs 실질)
- 직급 범위
- 팀 구조
- 채용 배경

**Step 2 — 요구 역량 3분류** ⚠️ 매우 중요
- 필수 (Must-have): 없으면 서류 탈락. 최대 5개로 제한 (진짜 필수만!)
- 우대 (Nice-to-have): 있으면 가점. 필수를 우대로 잘못 분류 금지
- 숨은 요구역량 (Implicit): JD에 명시 안 됐지만 실제 필요한 역량

[역량 분류 기준]
✅ 필수: "○○ 경험 필수", "○○ 자격증 보유자", "○○ 5년 이상"
⚠️ 우대: "○○ 우대", "○○ 경험자 우대", "있으면 좋음"
💡 숨은: "채용 관리자 → 채용 프로세스 설계 능력", "스타트업 → 빠른 실행력"

**Step 3 — 헤드헌터 해석** ⚠️ 가장 중요
- 핵심 1명 프로파일: 구체적 인물상 (현실적으로 존재하는 사람!)
  예: "삼성전자에서 GaN Epi 공정 5년 이상, MOCVD 장비 직접 운영 경험, 박사학위 보유, 논문 3편 이상"
  ❌ 금지: "반도체 경험자", "우수한 엔지니어"

- 탐색 방향: 어디서 누구를 찾을지 (회사명, 직급, 경로)
  예: "삼성전자/SK하이닉스 GaN 사업부 책임급 이상, 학회 발표자 우선 접촉"
  ❌ 금지: "관련 업계에서 찾기", "경험자 물색"

**Step 4 — 클라이언트 코멘트 반영 (선택)**
코멘트가 있을 경우만:
- 요건 완화/강화
- 우선순위 변경
- 숨은 맥락 파악
- 기피 프로파일
- 처우 조건

## 하지 말 것
❌ JD 그대로 복사·나열
❌ 필수·우대 구분 없이 나열 (필수는 5개 이하!)
❌ "좋은 회사입니다" 같은 빈 말
❌ 비현실적 요구를 검증 없이 수용
❌ 코멘트 있는데 기본 출력만 제공
❌ 핵심 프로파일에 "경험자", "우수한" 같은 추상적 표현

${OUTPUT_RULES}

## 회사 정보 분석 (중요!)

**회사 정보가 충분한 경우:**
- JD 텍스트, 회사명, 웹사이트 정보를 종합하여 상세 분석
- introduction, revenue, current_business, recent_trends, future_value 모두 구체적으로 작성

**회사 정보가 불충분한 경우 (신규 스타트업, 비공개 회사 등):**
- introduction: "회사 정보 확인 불가"
- revenue: "정보 부족"
- current_business: "정보 부족"
- recent_trends: "정보 부족"
- future_value: "정보 부족"

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
  "company_analysis": {
    "introduction": "회사 소개 (업종, 주요 사업, 설립 배경). 정보 없으면 '회사 정보 확인 불가'",
    "revenue": "매출액 또는 규모 추정. 정보 없으면 '정보 부족'",
    "current_business": "현재 진행 중인 주요 사업/프로젝트. 정보 없으면 '정보 부족'",
    "recent_trends": "최근 동향 (채용 배경, 사업 확장 등). 정보 없으면 '정보 부족'",
    "future_value": "회사 미래 가치 및 성장 가능성. 정보 없으면 '정보 부족'"
  },
  "step3_headhunter_insight": {
    "core_profile": "핵심 1명 프로파일 (구체적 인물상 3-4문장, 구체적 수치와 프로젝트 포함)",
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

**중요**: 설명 없이 JSON만 출력하세요.`
}

const testInput = {
  text: `서울사업장 준법경영팀(계약)
_1년 계약 이후 상황에 따라 연장 또는 전환 검토 예정

[직급] 대리 ~ 책임
[직무]법무 업무
[수행업무]
-각종 계약서 및 법률 자문 검토
-소송 및 법적 분쟁 대응
-컴플라이언스 등 준법 지원
[필수요건]
-한국 변호사 자격 소지자
법무 경력 2~7년

[당사 복리후생]
· 복지포인트 연 1,000천원 지급 (입사시점 월할 지급 및 차년도 지급 시 잔여계약기간 월할 지급)
   · 법정 및 회사 복리후생 제공 (개인연금, 주택융자금 제외)
   · 변호사의 경우, 자격수당 제공

[채용 정보]
채용 희망일 : 10월 입사 희망
면접 예상일:  8월 말 예상

`,
  company: '롯데정밀화학',
  position: '준법경영팀'
}

console.log('🧪 Testing JD Parse with real input...\n')

try {
  // JD 분석 프롬프트
  let userContent = '다음 JD를 분석해주세요.\n\n'

  if (testInput.company || testInput.position) {
    userContent += '**기본 정보:**\n'
    if (testInput.company) userContent += `- 회사명: ${testInput.company}\n`
    if (testInput.position) userContent += `- 포지션: ${testInput.position}\n`
    userContent += '\n'
  }

  userContent += `**JD 내용:**\n${testInput.text}`

  console.log('📤 Calling Claude API...\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    system: [{
      type: 'text',
      text: getJDParsePrompt(),
      cache_control: { type: 'ephemeral' }
    }],
    messages: [{
      role: 'user',
      content: userContent
    }],
  })

  console.log('✅ Claude API response received\n')

  // JSON 파싱
  const textBlock = message.content.find(block => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  console.log('📥 Raw response:')
  console.log('=====================================')
  console.log(textBlock.text)
  console.log('=====================================\n')

  console.log('📊 Response stats:')
  console.log(`Length: ${textBlock.text.length} chars`)
  console.log(`Stop reason: ${message.stop_reason}`)
  console.log(`Tokens: input=${message.usage.input_tokens}, output=${message.usage.output_tokens}`)
  console.log('=====================================\n')

  // JSON 추출 (마크다운 및 추가 텍스트 제거)
  let rawText = textBlock.text.trim()

  // 마크다운 블록 제거
  if (rawText.includes('```json')) {
    const match = rawText.match(/```json\s*([\s\S]*?)```/)
    if (match) {
      rawText = match[1].trim()
    }
  } else if (rawText.includes('```')) {
    const match = rawText.match(/```\s*([\s\S]*?)```/)
    if (match) {
      rawText = match[1].trim()
    }
  }

  // JSON 객체 추출 (첫 번째 { 부터 마지막 } 까지)
  const firstBrace = rawText.indexOf('{')
  const lastBrace = rawText.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    console.error('❌ Invalid JSON structure')
    console.error('Raw text:', rawText)
    throw new Error('Invalid JSON structure in Claude response')
  }

  const jsonText = rawText.substring(firstBrace, lastBrace + 1)

  console.log('📝 Extracted JSON:')
  console.log('=====================================')
  console.log(jsonText.substring(0, 500))
  console.log('...')
  console.log('=====================================\n')

  try {
    const result = JSON.parse(jsonText)
    console.log('✅ JSON parsed successfully\n')
    console.log('📊 Parsed result:')
    console.log(JSON.stringify(result, null, 2))
  } catch (parseError) {
    console.error('❌ JSON parse error:', parseError.message)
    console.error('JSON text:', jsonText.substring(0, 500))
    throw new Error(`JSON parse failed: ${parseError.message}`)
  }

} catch (error) {
  console.error('\n❌ Test failed:', error.message)
  console.error('Error details:', error)
  process.exit(1)
}

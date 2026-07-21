/**
 * LinkedIn 검색을 위한 키워드 추출 유틸리티
 * headhunter-app 로직 기반 + Claude API 통합
 */

import Anthropic from '@anthropic-ai/sdk'

export interface LinkedInKeywords {
  coreJob: string
  qualifiers: string[]
  skills: string[]
}

/**
 * 정규식 기반 키워드 추출 (fallback)
 * headhunter-app의 로직을 TypeScript로 이식
 */
export function extractKeywordsRegex(position: string): LinkedInKeywords {
  let raw = position || ''

  // 1. 회사명 제거: "콴다인스티튜트 - 데이터..." → "데이터..."
  raw = raw.replace(/^.+?[-–—]\s*/, '').trim()

  // 2. 직급/레벨 제거: (팀장급), (시니어), 리드, 책임, 수석, 매니저 등
  const levelWords = /([\(（][^）)]*(?:급|레벨|level)[）)]|\b(?:리드|Lead|시니어|Senior|주니어|Junior|책임|수석|매니저|Manager|Head|팀장|Director|VP|C-Level|임원)\b)/gi
  raw = raw.replace(levelWords, '').replace(/\s{2,}/g, ' ').trim()

  // 3. 팀/조직명 앞부분 제거
  raw = raw.replace(/^[^\s(（\/]+(?:팀|파트|그룹|센터|본부|실|부서|부문)\s*/i, '').trim()

  // 4. "/" 로 분리된 수식어 추출: "데이터/그로스 마케팅" → core="마케팅", qualifiers=["데이터","그로스"]
  const parts = raw.split('/').map(s => s.trim()).filter(Boolean)
  let coreJob = parts[parts.length - 1] // 마지막이 보통 핵심 직무
  const qualifiers: string[] = parts.slice(0, -1) // 앞쪽은 수식어

  // 핵심 직무에서 수식어 단어 분리 (예: "그로스 마케팅" → core="마케팅", qualifier추가="그로스")
  const coreWords = coreJob.split(/\s+/)
  if (coreWords.length > 1) {
    coreJob = coreWords[coreWords.length - 1]
    qualifiers.unshift(...coreWords.slice(0, -1))
  }

  // 5. 괄호 안 내용은 수식어로
  const parenMatches = [...raw.matchAll(/[（(]([^）)]+)[）)]/g)]
  parenMatches.forEach(m => qualifiers.push(m[1].trim()))

  // 중복 제거
  const uniqueQualifiers = [...new Set(qualifiers)]

  return {
    coreJob,
    qualifiers: uniqueQualifiers,
    skills: [] // 정규식 방식에서는 스킬 추출 안 함
  }
}

/**
 * Claude API를 사용한 고급 키워드 추출
 */
export async function extractKeywordsWithClaude(position: string): Promise<LinkedInKeywords> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.warn('[extractKeywordsWithClaude] ANTHROPIC_API_KEY not found, falling back to regex')
    return extractKeywordsRegex(position)
  }

  try {
    const anthropic = new Anthropic({ apiKey })

    const prompt = `다음 채용 공고 직무명에서 LinkedIn 검색에 최적화된 키워드를 추출해주세요.

직무명: "${position}"

다음 형식의 JSON으로만 응답해주세요 (다른 설명 없이):
{
  "coreJob": "핵심 직무명 (예: 마케터, 개발자, 디자이너, 엔지니어)",
  "qualifiers": ["수식어1", "수식어2"],
  "skills": ["필수 스킬1", "필수 스킬2"]
}

규칙:
1. coreJob은 단일 직무명 (예: 마케터, 개발자, 디자이너)
2. qualifiers는 직무를 수식하는 단어들 (예: 그로스, 데이터, 퍼포먼스)
3. skills는 해당 직무에 필수적인 기술/도구 (예: Python, Figma, SQL)
4. 회사명, 직급(시니어, 주니어, 매니저 등)은 제외
5. 팀명, 조직명은 제외`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0 // 일관된 결과를 위해
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response')
    }

    // JSON 파싱 (마크다운 코드 블록 제거)
    let jsonText = textContent.text.trim()
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const keywords: LinkedInKeywords = JSON.parse(jsonText)

    // 검증
    if (!keywords.coreJob || !Array.isArray(keywords.qualifiers) || !Array.isArray(keywords.skills)) {
      throw new Error('Invalid keywords format from Claude')
    }

    return keywords

  } catch (error) {
    console.error('[extractKeywordsWithClaude] Error:', error)
    console.warn('[extractKeywordsWithClaude] Falling back to regex extraction')
    return extractKeywordsRegex(position)
  }
}

/**
 * LinkedIn 검색 쿼리 생성
 */
export function buildLinkedInSearchQuery(keywords: LinkedInKeywords, location: string = 'Korea'): string {
  const { coreJob, qualifiers, skills } = keywords

  // 모든 키워드를 따옴표로 감싸서 정확한 매칭
  const allKeywords = [
    `"${coreJob}"`,
    ...qualifiers.map(q => `"${q}"`),
    ...skills.map(s => `"${s}"`)
  ].join(' ')

  // 위치 검색 (한국어 + 영어)
  const locationStr = location === 'Korea'
    ? '(서울 OR 한국 OR Seoul OR Korea)'
    : `(${location})`

  return `site:linkedin.com/in ${allKeywords} ${locationStr}`.trim()
}

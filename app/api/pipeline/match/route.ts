import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getMatchingPrompt } from '@/lib/prompts/base-headhunter'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { jd, candidate } = await req.json()
    if (!jd || !candidate) {
      return NextResponse.json({ error: 'JD와 후보자 정보가 필요합니다.' }, { status: 400 })
    }

    console.log('[pipeline/match] Starting analysis for JD:', jd.position)
    console.log('[pipeline/match] Candidate data:', {
      id: candidate.id,
      current_position: candidate.current_position,
      hasSkills: !!candidate.skills,
      hasTechStack: !!candidate.tech_stack,
      hasEducation: !!candidate.education,
      hasCertifications: !!candidate.certifications
    })

    // 안전한 배열 처리 헬퍼 함수
    const safeJoin = (arr: any, separator: string = ', '): string => {
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.join(separator)
      }
      return '없음'
    }

    console.log('[pipeline/match] Calling Claude API...')
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: [{
        type: 'text',
        text: getMatchingPrompt(), // ✨ Enhanced prompt from ADAM
        cache_control: { type: 'ephemeral' }
      }],
      messages: [{
        role: 'user',
        content: `다음 JD와 후보자의 적합도를 분석해주세요:

【JD 정보】
- 회사: ${jd.company ?? '미상'}
- 포지션: ${jd.position}
- 필수 스킬: ${safeJoin(jd.required_skills)}
- 우대 스킬: ${safeJoin(jd.preferred_skills)}
- 난이도: ${jd.difficulty}
- 타깃 프로파일: ${jd.target_profile ?? '없음'}
- 서칭 전략: ${jd.search_strategy ?? '없음'}

【후보자 정보】
🔒 개인정보 보호: 이름, 회사명 등 개인정보는 제외됨
- 현재 포지션: ${candidate.current_position ?? '미상'}
- 경력: ${candidate.total_experience_years ? `${candidate.total_experience_years}년` : '미상'}
- 스킬: ${safeJoin(candidate.skills)}
- 기술스택: ${safeJoin(candidate.tech_stack)}
- 자격증: ${safeJoin(candidate.certifications)}
- 학력: ${safeJoin(candidate.education)}
- 강점 요약: ${candidate.strength_summary ?? '없음'}
- 약점 분석: ${candidate.weakness_summary ?? '없음'}
- 커리어 방향: ${candidate.career_trajectory ?? '없음'}
- 경력 요약: ${candidate.career_summary ?? '없음'}
`
      }],
    })

    console.log('[pipeline/match] Claude API response received')
    const raw = (message.content[0] as { type: string; text: string }).text
    console.log('[pipeline/match] Claude response preview:', raw.substring(0, 200))

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[pipeline/match] No JSON found in response. Full response:', raw)
      return NextResponse.json({ error: '매칭 분석 실패. 다시 시도해 주세요.' }, { status: 500 })
    }

    let result
    try {
      result = JSON.parse(match[0])
    } catch (parseError: any) {
      console.error('[pipeline/match] JSON parse error:', parseError.message)
      console.error('[pipeline/match] Attempted to parse:', match[0])
      return NextResponse.json({ error: 'JSON 파싱 실패. 다시 시도해 주세요.' }, { status: 500 })
    }

    console.log('[pipeline/match] Analysis complete. Score:', result.match_score)
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[pipeline/match] Error:', e.message)
    console.error('[pipeline/match] Stack:', e.stack)
    return NextResponse.json({
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? e.message : undefined
    }, { status: 500 })
  }
}

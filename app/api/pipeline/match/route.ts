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

    console.log('[pipeline/match] ========== STARTING MATCH ANALYSIS ==========')
    console.log('[pipeline/match] JD data received:', {
      id: jd.id,
      position: jd.position,
      company: jd.company,
      required_skills: jd.required_skills,
      preferred_skills: jd.preferred_skills,
      difficulty: jd.difficulty,
      target_profile: jd.target_profile?.substring(0, 50),
      search_strategy: jd.search_strategy?.substring(0, 50)
    })
    console.log('[pipeline/match] Candidate data received:', {
      id: candidate.id,
      current_position: candidate.current_position,
      total_experience_years: candidate.total_experience_years,
      skills: candidate.skills,
      tech_stack: candidate.tech_stack,
      certifications: candidate.certifications,
      education: candidate.education,
      hasStrength: !!candidate.strength_summary,
      hasWeakness: !!candidate.weakness_summary,
      hasCareerSummary: !!candidate.career_summary,
      hasCareerTrajectory: !!candidate.career_trajectory
    })

    // 안전한 배열 처리 헬퍼 함수
    const safeJoin = (arr: any, separator: string = ', '): string => {
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.join(separator)
      }
      return '없음'
    }

    console.log('[pipeline/match] Calling Claude API...')

    // 🔍 프롬프트 생성 및 검증
    const userPrompt = `다음 JD와 후보자의 적합도를 분석해주세요:

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
    console.log('[pipeline/match] 📝 User prompt:', userPrompt.substring(0, 300) + '...')

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
        content: userPrompt
      }],
    })

    console.log('[pipeline/match] ✅ Claude API response received')

    // Content 검증
    if (!message.content || message.content.length === 0) {
      console.error('[pipeline/match] ❌ Empty content from Claude')
      return NextResponse.json({
        error: 'AI 응답이 비어있습니다.',
        details: 'Claude API returned empty content'
      }, { status: 500 })
    }

    const firstContent = message.content[0]
    if (firstContent.type !== 'text') {
      console.error('[pipeline/match] ❌ Unexpected content type:', firstContent.type)
      return NextResponse.json({
        error: 'AI 응답 형식 오류',
        details: `Expected text, got ${firstContent.type}`
      }, { status: 500 })
    }

    const raw = firstContent.text
    console.log('[pipeline/match] 📄 Raw response length:', raw.length)
    console.log('[pipeline/match] 📄 Response preview:', raw.substring(0, 200) + '...')

    // 🔧 마크다운 코드 블록 제거 (```json ... ``` 패턴)
    let cleanedRaw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    console.log('[pipeline/match] 🧹 Cleaned response preview:', cleanedRaw.substring(0, 200) + '...')

    const match = cleanedRaw.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[pipeline/match] ❌ No JSON found in response.')
      console.error('[pipeline/match] ❌ Full response:', raw)
      return NextResponse.json({
        error: '매칭 분석 실패. AI가 올바른 형식으로 응답하지 않았습니다.',
        details: 'No JSON object found in response'
      }, { status: 500 })
    }

    let result
    try {
      result = JSON.parse(match[0])
      console.log('[pipeline/match] ✅ JSON parsed successfully')
    } catch (parseError: any) {
      console.error('[pipeline/match] ❌ JSON parse error:', parseError.message)
      console.error('[pipeline/match] ❌ Attempted to parse:', match[0].substring(0, 500))
      return NextResponse.json({
        error: 'JSON 파싱 실패. 다시 시도해 주세요.',
        details: parseError.message
      }, { status: 500 })
    }

    console.log('[pipeline/match] ✅ Analysis complete. Score:', result.match_score)
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[pipeline/match] ❌❌❌ FATAL ERROR ❌❌❌')
    console.error('[pipeline/match] Error name:', e.name)
    console.error('[pipeline/match] Error message:', e.message)
    console.error('[pipeline/match] Error stack:', e.stack)

    // Anthropic API 에러 상세 정보
    if (e.status) {
      console.error('[pipeline/match] Anthropic API status:', e.status)
      console.error('[pipeline/match] Anthropic API error:', e.error)
    }

    return NextResponse.json({
      error: '서버 오류가 발생했습니다.',
      details: e.message || 'Unknown error'
    }, { status: 500 })
  }
}

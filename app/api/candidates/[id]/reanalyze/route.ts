import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Anthropic from '@anthropic-ai/sdk'
import { handleAnthropicError } from '@/lib/handle-anthropic-error'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. 후보자 조회 (모든 필드)
    const { data: candidate, error: fetchError } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !candidate) {
      return NextResponse.json({ error: '후보자를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!candidate.raw_resume) {
      return NextResponse.json({ error: '원본 이력서 데이터가 없습니다.' }, { status: 400 })
    }

    console.log(`[재분석] ${candidate.name} (${id})`)
    console.log(`[재분석] 기존 정보 보존 모드 활성화`)

    // 2. 기존 정보 정리 (메타데이터 포함)
    const existingInfo = {
      name: candidate.name,
      current_company: candidate.current_company,
      current_position: candidate.current_position,
      total_experience_years: candidate.total_experience_years,
      career_summary: candidate.career_summary,
      education: candidate.education,
      skills: candidate.skills,
      tech_stack: candidate.tech_stack,
      certifications: candidate.certifications,
      languages: candidate.languages,
      strength_summary: candidate.strength_summary,
      weakness_summary: candidate.weakness_summary,
      career_trajectory: candidate.career_trajectory,
      ideal_roles: candidate.ideal_roles,
      key_highlights: candidate.key_highlights,
      market_value: candidate.market_value,
      desired_position: candidate.desired_position,
      desired_salary: candidate.desired_salary,
      job_search_status: candidate.job_search_status,
      headhunter_notes: candidate.headhunter_notes,
      metadata: candidate.metadata,
    }

    // 3. Claude API로 재분석 (기존 정보 + raw_resume)
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `당신은 15년 경력의 헤드헌터입니다. 후보자 정보를 재분석하고 업데이트해주세요.

# 📋 기존 후보자 정보

${JSON.stringify(existingInfo, null, 2)}

# 📄 이력서 원본 (Raw Resume)

${candidate.raw_resume}

---

# 🎯 분석 지침

**CRITICAL: 기존 정보 최대한 보존**
- 기존에 입력된 정보가 있으면 **반드시 유지**
- 새로운 정보가 발견되면 **추가/확장**
- 기존 정보가 명백히 잘못되었을 때만 수정
- **절대 정보를 삭제하거나 축소하지 마세요**

**메타데이터 활용 (특히 중요!)**
- metadata.original_data가 있으면 이전 분석 결과입니다
- 특히 **커리어 방향 (career_direction)** 정보가 있으면 최대한 반영
- 이전 분석의 통찰을 현재 분석에 통합하세요

**상세 분석 요구사항:**

1. **경력 요약 (career_summary)**
   - 최소 3-5줄로 상세하게 작성
   - 주요 경력사항, 담당 업무, 성과 포함
   - 기존 내용이 있으면 확장

2. **스킬/기술스택 (skills, tech_stack)**
   - 이력서에서 발견되는 **모든** 기술 나열
   - 프로그래밍 언어, 프레임워크, 도구, 방법론 등
   - 기존 배열에 **추가** (중복 제거)

3. **강점 요약 (strength_summary)**
   - 3-5줄로 구체적으로 작성
   - 숫자/성과 중심으로
   - 기존 내용 확장

4. **약점/보완점 (weakness_summary)**
   - 2-3줄로 객관적으로 분석
   - 경력 공백, 부족한 스킬 등

5. **핵심 성과 (key_highlights)**
   - 최소 5개 이상 나열
   - 구체적 숫자/성과 포함
   - 기존 배열에 추가

6. **적합 포지션 (ideal_roles)**
   - 경력 기반으로 3-5개 제시
   - 기존 배열에 추가

7. **학력 (education)**
   - 모든 학력사항 나열
   - 기존 배열에 추가

8. **자격증 (certifications)**
   - 모든 자격증/면허 나열
   - 기존 배열에 추가

9. **언어 (languages)**
   - 한국어, 영어 등 모든 언어 능력
   - 기존 배열에 추가

---

# 📤 응답 형식

다음 JSON 형식으로 응답하세요:

\`\`\`json
{
  "name": "이름",
  "current_company": "현재 회사명 또는 null",
  "current_position": "현재 직급/직책",
  "total_experience_years": 총경력년수(숫자),
  "career_summary": "상세한 경력 요약 (3-5줄)",
  "education": ["학력1", "학력2", ...],
  "skills": ["스킬1", "스킬2", "스킬3", ...],
  "tech_stack": ["기술1", "기술2", ...],
  "certifications": ["자격증1", ...],
  "languages": ["한국어", "영어", ...],
  "strength_summary": "강점 요약 (3-5줄)",
  "weakness_summary": "약점 분석 (2-3줄)",
  "career_trajectory": "커리어 궤적 분석",
  "ideal_roles": ["포지션1", "포지션2", ...],
  "key_highlights": ["성과1", "성과2", "성과3", ...],
  "market_value": "시장가치 (A+/A/B+/B/C 등급)",
  "desired_position": "희망 직무",
  "desired_salary": "희망 연봉",
  "job_search_status": "적극적/잠재적/미상"
}
\`\`\`

**중요:**
- 배열은 **기존 항목 + 새로 발견한 항목** 모두 포함 (중복 제거)
- 정보가 없으면 null 또는 빈 배열
- 모든 텍스트는 한국어로
- JSON만 응답 (마크다운 코드블록 사용)`
        }
      ]
    })

    // 3. 응답 파싱
    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Claude API 응답 형식 오류')
    }

    let responseText = textContent.text.trim()

    // 마크다운 코드 블록 제거
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '')

    const analysis = JSON.parse(responseText)

    console.log('[재분석] 파싱 성공:', analysis.name)

    // 4. 배열 필드 병합 (기존 + 새로운, 중복 제거)
    const mergeArrays = (existing: any[], newItems: any[]) => {
      const merged = [...(existing || []), ...(newItems || [])]
      return [...new Set(merged)].filter(Boolean)
    }

    const education = mergeArrays(candidate.education, analysis.education)
    const skills = mergeArrays(candidate.skills, analysis.skills)
    const tech_stack = mergeArrays(candidate.tech_stack, analysis.tech_stack)
    const certifications = mergeArrays(candidate.certifications, analysis.certifications)
    const languages = mergeArrays(candidate.languages, analysis.languages)
    const ideal_roles = mergeArrays(candidate.ideal_roles, analysis.ideal_roles)
    const key_highlights = mergeArrays(candidate.key_highlights, analysis.key_highlights)

    // 텍스트 필드: 새 내용이 더 길면 사용, 아니면 기존 유지
    const useLongerText = (existing: string | null, newText: string | null) => {
      if (!existing) return newText
      if (!newText) return existing
      return newText.length > existing.length ? newText : existing
    }

    console.log('[재분석] 병합 결과:')
    console.log(`  - skills: ${candidate.skills?.length || 0} → ${skills.length}`)
    console.log(`  - tech_stack: ${candidate.tech_stack?.length || 0} → ${tech_stack.length}`)
    console.log(`  - key_highlights: ${candidate.key_highlights?.length || 0} → ${key_highlights.length}`)

    // 5. Supabase 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update({
        name: analysis.name || candidate.name,
        current_company: analysis.current_company || candidate.current_company,
        current_position: analysis.current_position || candidate.current_position,
        total_experience_years: analysis.total_experience_years || candidate.total_experience_years,
        career_summary: useLongerText(candidate.career_summary, analysis.career_summary),
        education,
        skills,
        tech_stack,
        certifications,
        languages,
        strength_summary: useLongerText(candidate.strength_summary, analysis.strength_summary),
        weakness_summary: useLongerText(candidate.weakness_summary, analysis.weakness_summary),
        career_trajectory: useLongerText(candidate.career_trajectory, analysis.career_trajectory),
        ideal_roles,
        key_highlights,
        market_value: analysis.market_value || candidate.market_value,
        desired_position: analysis.desired_position || candidate.desired_position,
        desired_salary: analysis.desired_salary || candidate.desired_salary,
        job_search_status: analysis.job_search_status || candidate.job_search_status || '미상',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[재분석] 업데이트 실패:', updateError)
      return NextResponse.json({ error: '업데이트 실패: ' + updateError.message }, { status: 500 })
    }

    console.log('[재분석] 완료:', candidate.name)

    return NextResponse.json({
      success: true,
      message: '재분석 완료',
      data: analysis,
    })

  } catch (error: any) {
    console.error('[재분석 API]', error)

    const errorResponse = handleAnthropicError(error)

    return NextResponse.json({
      error: errorResponse.userMessage,
      shouldContact: errorResponse.shouldContact,
      errorCode: errorResponse.error,
    }, { status: 500 })
  }
}

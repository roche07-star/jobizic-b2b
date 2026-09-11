import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-client'
import { handleAnthropicError } from '@/lib/handle-anthropic-error'
import { createClient } from '@supabase/supabase-js'
import { getServerProfile } from '@/lib/supabase-server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * 🚀 빠른 JD 분석 (Job 시스템 우회)
 * - Job 테이블 사용 안 함
 * - 즉시 Claude API 호출 후 결과 반환
 * - max_tokens: 1500 (3000 → 1500)
 * - 간소화된 프롬프트
 */
export async function POST(req: NextRequest) {
  try {
    const {
      text,
      company,
      position,
      company_url,
      client_comment,
      // 추가 메타데이터
      location,
      fee_rate,
      recruitment_process
    } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: 'JD 내용을 입력해 주세요.' }, { status: 400 })
    }

    // 인증 확인
    const profile = await getServerProfile()
    if (!profile) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    console.log('[jd/parse-fast] 🚀 Fast parsing started...')

    // 간소화된 프롬프트
    const systemPrompt = `당신은 10년 경력의 한국 시니어 헤드헌터입니다.

[분석 원칙]
1. JD를 정확히 파악하고 구조화된 데이터로 반환
2. 필수/우대 스킬을 명확히 구분
3. 포지션의 난이도와 타깃 프로파일을 간단히 요약

[출력 형식] - JSON만 반환 (설명 없이)
{
  "company": "회사명",
  "position": "포지션명",
  "required_skills": ["필수1", "필수2"],
  "preferred_skills": ["우대1", "우대2"],
  "responsibilities": ["업무1", "업무2"],
  "qualifications": ["자격1", "자격2"],
  "difficulty": "하/중/상",
  "target_profile": "타깃 인재상 한 줄 요약",
  "salary_range": "연봉 범위 (있으면)",
  "location": "근무지 (있으면)"
}`

    // JD 분석 프롬프트
    let userContent = '다음 JD를 분석해주세요.\n\n'

    if (company || position) {
      userContent += '**기본 정보:**\n'
      if (company) userContent += `- 회사명: ${company}\n`
      if (position) userContent += `- 포지션: ${position}\n`
      userContent += '\n'
    }

    userContent += `**JD 내용:**\n${text}`

    if (client_comment) {
      userContent += `\n\n**클라이언트 코멘트:**\n${client_comment}`
    }

    // Claude API 호출 (max_tokens: 1500)
    const message = await callClaude({
      max_tokens: 1500, // ✅ 3000 → 1500 (50% 감소)
      system: [{
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }],
      messages: [{
        role: 'user',
        content: userContent
      }],
    })

    // JSON 파싱
    const textBlock = message.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // JSON 추출
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

    // JSON 객체 추출
    const firstBrace = rawText.indexOf('{')
    const lastBrace = rawText.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      console.error('[jd/parse-fast] Invalid JSON structure:', rawText)
      throw new Error('Invalid JSON structure in Claude response')
    }

    const jsonText = rawText.substring(firstBrace, lastBrace + 1)

    let result
    try {
      result = JSON.parse(jsonText)
    } catch (parseError: any) {
      console.error('[jd/parse-fast] JSON parse error:', parseError.message)
      console.error('[jd/parse-fast] JSON text:', jsonText.substring(0, 500))
      throw new Error(`JSON parse failed: ${parseError.message}`)
    }

    console.log('[jd/parse-fast] ✅ Parsing completed')

    // Supabase에 JD 저장
    const { data: jd, error: jdError } = await supabase
      .from('job_descriptions')
      .insert({
        company: result.company || company,
        position: result.position || position,
        location: result.location || location || null,
        fee_rate: fee_rate || null,
        required_skills: result.required_skills || [],
        preferred_skills: result.preferred_skills || [],
        responsibilities: result.responsibilities || [],
        qualifications: result.qualifications || [],
        difficulty: result.difficulty || null,
        target_profile: result.target_profile || null,
        salary_range: result.salary_range || null,
        company_url: company_url || null,
        recruitment_process: recruitment_process || null,
        raw_text: text,
        client_comment: client_comment || null,
        created_by: profile.email,
        organization_id: profile.organization_id || null,
        status: 'active'
      })
      .select()
      .single()

    if (jdError || !jd) {
      console.error('[jd/parse-fast] DB save failed:', jdError)
      throw new Error('JD 저장 실패')
    }

    console.log('[jd/parse-fast] ✅ JD saved to DB:', jd.id)

    return NextResponse.json({
      success: true,
      jd_id: jd.id,
      result,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens
      }
    })

  } catch (error: any) {
    console.error('[jd/parse-fast] ❌ Error:', error)

    const errorResponse = handleAnthropicError(error)

    return NextResponse.json({
      error: errorResponse.userMessage,
      shouldContact: errorResponse.shouldContact,
      errorCode: errorResponse.error
    }, { status: 500 })
  }
}

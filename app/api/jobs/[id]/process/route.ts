import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCandidateParsePrompt, getJDParsePrompt } from '@/lib/prompts/base-headhunter'
import { createClient } from '@supabase/supabase-js'
import { callClaude } from '@/lib/claude-client'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Tool 정의 (parse API와 동일)
const CANDIDATE_PARSE_TOOL: Anthropic.Tool = {
  name: 'analyze_candidate_resume',
  description: '후보자 이력서를 분석하여 구조화된 형식으로 반환',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      birth_year: { type: 'number' },
      location: { type: 'string' },
      current_company: { type: 'string', description: '현재 회사 (없으면 null)' },
      current_position: { type: 'string', description: '현재 직급/포지션 (없으면 null)' },
      total_experience_years: { type: 'number', description: '총 경력 년수' },
      career_summary: { type: 'string', description: '회사별 경력 요약 (예: A사 3년 (백엔드) -> B사 5년 (팀장) -> C사 2년 (시니어))' },
      education: { type: 'array', items: { type: 'string' }, description: '학력 (최종학력부터)' },
      skills: { type: 'array', items: { type: 'string' } },
      tech_stack: { type: 'array', items: { type: 'string' } },
      certifications: { type: 'array', items: { type: 'string' } },
      languages: { type: 'array', items: { type: 'string' } },
      desired_position: { type: 'string' },
      desired_salary: { type: 'string' },
      desired_location: { type: 'string' },
      job_search_status: { type: 'string', enum: ['적극적', '관심있음', '잠재적'] },
      strength_summary: { type: 'string' },
      weakness_summary: { type: 'string' },
      career_trajectory: { type: 'string' },
      ideal_roles: { type: 'array', items: { type: 'string' } },
      market_value: { type: 'string' },
      key_highlights: { type: 'array', items: { type: 'string' } },
      tags: { type: 'array', items: { type: 'string' } }
    },
    required: ['total_experience_years', 'career_summary', 'education', 'skills']
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params

    console.log('[jobs/process] Processing job:', jobId)

    // 1. Job 조회
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'pending' && job.status !== 'processing') {
      return NextResponse.json({
        error: 'Job already processed',
        status: job.status
      }, { status: 400 })
    }

    // 2. 처리 시작
    await supabase
      .from('jobs')
      .update({ status: 'processing', progress: 20, message: 'AI 분석 시작...' })
      .eq('id', jobId)

    // 3. Job 타입별 처리
    let result: any

    if (job.job_type === 'candidate_parse') {
      // 후보자 파싱
      const { maskedText, personalInfo } = job.input as {
        maskedText: string
        personalInfo: any
      }

      const today = new Date()
      const currentDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

      // 35% - Claude API 호출 전
      await supabase
        .from('jobs')
        .update({ progress: 35, message: '이력서 읽는 중...' })
        .eq('id', jobId)

      console.log('[jobs/process] Candidate parsing - Calling Claude API...')

      const message = await callClaude({
        max_tokens: 4096,
        system: [{
          type: 'text',
          text: getCandidateParsePrompt(),
          cache_control: { type: 'ephemeral' }
        }],
        tools: [CANDIDATE_PARSE_TOOL],
        tool_choice: { type: 'tool', name: 'analyze_candidate_resume' },
        messages: [{
          role: 'user',
          content: `**중요: 오늘은 ${currentDate}입니다.**\n\n다음 이력서를 분석해주세요:\n\n${maskedText}`
        }],
      })

      // 70% - Claude API 응답 받음
      await supabase
        .from('jobs')
        .update({ progress: 70, message: 'AI 분석 완료, 결과 생성 중...' })
        .eq('id', jobId)

      const toolUseBlock = message.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      )

      if (!toolUseBlock) {
        throw new Error('No tool_use block found')
      }

      const parsed = toolUseBlock.input as any

      // 85% - 파싱 완료
      await supabase
        .from('jobs')
        .update({ progress: 85, message: '결과 정리 중...' })
        .eq('id', jobId)

      result = {
        ...parsed,
        name: personalInfo.name || parsed.name,
        email: personalInfo.email || parsed.email,
        phone: personalInfo.phone || parsed.phone,
        birth_year: personalInfo.birth_year || parsed.birth_year,
        location: personalInfo.location || parsed.location,
      }

    } else if (job.job_type === 'jd_parse') {
      // JD 파싱
      const { text, company_url, client_comment } = job.input as {
        text: string
        company_url?: string
        client_comment?: string
      }

      // 35% - Claude API 호출 전
      await supabase
        .from('jobs')
        .update({ progress: 35, message: 'JD 읽는 중...' })
        .eq('id', jobId)

      console.log('[jobs/process] JD parsing - Calling Claude API...')

      // 간소화된 JD 분석 (tool use 없이 직접 JSON)
      const userContent = client_comment
        ? `다음 JD를 분석하고, 클라이언트 코멘트를 반영해주세요.\n\nJD:\n${text}\n\n클라이언트 코멘트:\n${client_comment}`
        : `다음 JD를 분석해주세요:\n\n${text}`

      const message = await callClaude({
        max_tokens: 4000,
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

      // 70% - Claude API 응답 받음
      await supabase
        .from('jobs')
        .update({ progress: 70, message: 'AI 분석 완료, 결과 생성 중...' })
        .eq('id', jobId)

      // JSON 파싱
      const textBlock = message.content.find(block => block.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from Claude')
      }

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
        console.error('[jobs/process] Invalid JSON structure:', rawText)
        throw new Error('Invalid JSON structure in Claude response')
      }

      const jsonText = rawText.substring(firstBrace, lastBrace + 1)

      // 85% - JSON 파싱 중
      await supabase
        .from('jobs')
        .update({ progress: 85, message: '결과 정리 중...' })
        .eq('id', jobId)

      try {
        result = JSON.parse(jsonText)
      } catch (parseError: any) {
        console.error('[jobs/process] JSON parse error:', parseError.message)
        console.error('[jobs/process] JSON text:', jsonText.substring(0, 500))
        throw new Error(`JSON parse failed: ${parseError.message}`)
      }

    } else {
      throw new Error(`Unknown job_type: ${job.job_type}`)
    }

    console.log('[jobs/process] ✅ Claude API response received')

    // 4. Job 완료 처리
    await supabase
      .from('jobs')
      .update({
        status: 'completed',
        result,
        progress: 100,
        message: '분석 완료',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

    console.log('[jobs/process] ✅ Job completed:', jobId)

    return NextResponse.json({
      success: true,
      jobId,
      status: 'completed'
    })

  } catch (error: any) {
    console.error('[jobs/process] Error:', error)

    const { id: jobId } = await params

    // Job 실패 처리
    await supabase
      .from('jobs')
      .update({
        status: 'failed',
        error: error.message,
        progress: 0,
        message: '분석 실패',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

    return NextResponse.json({
      error: error.message || 'Processing failed'
    }, { status: 500 })
  }
}

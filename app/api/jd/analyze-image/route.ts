import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 })
    }

    // 이미지 파일 확인
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다.' }, { status: 400 })
    }

    console.log('[JD 이미지 분석] 파일:', file.name, file.type, file.size)

    // 파일을 base64로 변환
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')

    // 미디어 타입 결정
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
    if (file.type === 'image/png') mediaType = 'image/png'
    else if (file.type === 'image/gif') mediaType = 'image/gif'
    else if (file.type === 'image/webp') mediaType = 'image/webp'

    console.log('[JD 이미지 분석] Claude Vision API 호출...')

    // Claude Vision API로 텍스트 추출
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `이미지에서 채용공고(Job Description) 텍스트를 추출해주세요.

**지침:**
- 이미지에 있는 **모든 텍스트**를 정확하게 추출
- 원본 포맷 최대한 유지 (줄바꿈, 섹션 구분 등)
- 회사명, 포지션, 자격요건, 우대사항, 업무내용, 연봉, 근무지 등 모든 정보 포함
- 표나 목록 형태도 최대한 보존
- 텍스트만 추출 (설명이나 주석 없이)

추출된 텍스트:`
            }
          ],
        },
      ],
    })

    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Claude API 응답 형식 오류')
    }

    const extractedText = textContent.text.trim()

    console.log('[JD 이미지 분석] 추출 완료:', extractedText.length, '자')

    if (extractedText.length < 50) {
      return NextResponse.json({
        error: '추출된 텍스트가 너무 짧습니다. 이미지가 명확한지 확인해주세요.',
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      text: extractedText,
    })

  } catch (error: any) {
    console.error('[JD 이미지 분석]', error)
    return NextResponse.json({
      error: '이미지 분석 중 오류가 발생했습니다.',
      details: error.message,
    }, { status: 500 })
  }
}

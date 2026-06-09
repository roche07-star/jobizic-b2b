import mammoth from 'mammoth'
import Anthropic from '@anthropic-ai/sdk'

function detectFileType(buffer: Buffer): 'pdf' | 'docx' | 'doc' | 'hwp' | 'unknown' {
  if (buffer.length < 8) return 'unknown'
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'pdf'
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) return 'docx'
  if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) return 'doc'
  if (buffer.slice(0, 16).toString('latin1').startsWith('HWP Document Fil')) return 'hwp'
  return 'unknown'
}

async function extractTextFromImagePDF(buffer: Buffer): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const base64 = buffer.toString('base64')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.messages.create as any)({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: '이 이력서 PDF의 텍스트를 빠짐없이 추출해 주세요. 원본 내용을 그대로 출력하고 어떠한 수정도 하지 마세요.',
          },
        ],
      },
    ],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block = response.content.find((c: any) => c.type === 'text')
  return block?.type === 'text' ? block.text : ''
}

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const detected = detectFileType(buffer)
  const fileType = detected !== 'unknown' ? detected : ext

  if (fileType === 'pdf') {
    const { extractText: pdfExtract } = await import('unpdf')
    const { text } = await pdfExtract(new Uint8Array(buffer))
    const result = Array.isArray(text) ? text.join('\n') : text

    if (!result.trim()) {
      // 이미지 기반 PDF → Claude Vision으로 OCR 폴백
      const ocrText = await extractTextFromImagePDF(buffer)
      if (!ocrText.trim()) {
        throw new Error('PDF에서 텍스트를 추출할 수 없습니다. 파일이 손상되었거나 내용이 없을 수 있습니다.')
      }
      return ocrText
    }
    return result
  }

  if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ buffer })
    if (!result.value.trim()) {
      throw new Error('DOCX 파일에서 텍스트를 읽을 수 없습니다. 파일이 손상되었거나 보호되어 있을 수 있습니다.')
    }
    return result.value
  }

  if (fileType === 'doc') {
    throw new Error(
      '구형 Word(.doc) 형식은 지원되지 않습니다. Word에서 파일 → 다른 이름으로 저장 → .docx 또는 PDF로 변환 후 업로드해 주세요.'
    )
  }

  if (fileType === 'hwp' || ext === 'hwp') {
    throw new Error('HWP 형식은 지원되지 않습니다. 한글에서 파일 → PDF로 저장 후 업로드해 주세요.')
  }

  if (ext === 'txt') {
    return buffer.toString('utf-8')
  }

  throw new Error('지원하지 않는 파일 형식입니다. PDF 또는 DOCX 파일을 업로드해 주세요.')
}

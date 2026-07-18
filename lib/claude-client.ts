import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Claude 모델 우선순위 (최신순)
 * 404 에러 시 자동으로 다음 모델로 fallback
 */
const MODELS = [
  'claude-haiku-4-5-20251001',      // 최신 Haiku 4.5
  'claude-3-5-haiku-20241022',      // Haiku 3.5
  'claude-3-haiku-20240307',        // Haiku 3 (legacy)
] as const

/**
 * Claude API 호출 (자동 fallback)
 *
 * @example
 * const message = await callClaude({
 *   max_tokens: 4096,
 *   messages: [{ role: 'user', content: 'Hello' }]
 * })
 */
export async function callClaude(
  params: Omit<Anthropic.MessageCreateParams, 'model'>,
  modelIndex = 0
): Promise<Anthropic.Message> {
  const model = MODELS[modelIndex]

  try {
    console.log(`[Claude] Calling with model: ${model}`)

    const response = await client.messages.create({
      model,
      ...params,
    } as Anthropic.MessageCreateParams) as Anthropic.Message

    return response
  } catch (error: any) {
    // 404 에러 (모델 없음) 시 다음 모델로 재시도
    if (error.status === 404 && modelIndex < MODELS.length - 1) {
      console.warn(`[Claude] Model ${model} not found, trying next...`)
      return callClaude(params, modelIndex + 1)
    }

    // 다른 에러거나 더 이상 fallback 없으면 throw
    console.error(`[Claude] Error with model ${model}:`, error.message)
    throw error
  }
}

/**
 * 스트리밍 호출 (자동 fallback)
 */
export function streamClaude(
  params: Omit<Anthropic.MessageStreamParams, 'model'>,
  modelIndex = 0
) {
  const model = MODELS[modelIndex]

  try {
    console.log(`[Claude] Streaming with model: ${model}`)

    return client.messages.stream({
      model,
      ...params,
    })
  } catch (error: any) {
    if (error.status === 404 && modelIndex < MODELS.length - 1) {
      console.warn(`[Claude] Model ${model} not found, trying next...`)
      return streamClaude(params, modelIndex + 1)
    }

    console.error(`[Claude] Error with model ${model}:`, error.message)
    throw error
  }
}

export { client }

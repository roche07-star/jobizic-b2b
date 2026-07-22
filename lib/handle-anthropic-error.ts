/**
 * Anthropic API 에러 처리 유틸
 *
 * 사용자 친화적인 에러 메시지로 변환합니다.
 */

export interface AnthropicErrorResponse {
  error: string
  userMessage: string
  shouldContact: boolean
}

export function handleAnthropicError(error: any): AnthropicErrorResponse {
  // 크레딧 부족
  if (
    error.message?.includes('credit balance is too low') ||
    error.message?.includes('insufficient_quota') ||
    error.error?.message?.includes('credit balance is too low')
  ) {
    return {
      error: 'INSUFFICIENT_CREDITS',
      userMessage: 'JOBIZIC 고객센터에 문의해주세요.',
      shouldContact: true,
    }
  }

  // Rate limit
  if (
    error.status === 429 ||
    error.message?.includes('rate_limit') ||
    error.message?.includes('too many requests')
  ) {
    return {
      error: 'RATE_LIMIT',
      userMessage: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      shouldContact: false,
    }
  }

  // 모델 없음 (이미 fallback 처리됨)
  if (error.status === 404) {
    return {
      error: 'MODEL_NOT_FOUND',
      userMessage: 'AI 모델을 찾을 수 없습니다. JOBIZIC 고객센터에 문의해주세요.',
      shouldContact: true,
    }
  }

  // 타임아웃
  if (
    error.message?.includes('timeout') ||
    error.code === 'ETIMEDOUT'
  ) {
    return {
      error: 'TIMEOUT',
      userMessage: '요청 시간이 초과되었습니다. 다시 시도해주세요.',
      shouldContact: false,
    }
  }

  // 네트워크 에러
  if (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ENOTFOUND' ||
    error.message?.includes('network')
  ) {
    return {
      error: 'NETWORK_ERROR',
      userMessage: '네트워크 연결을 확인해주세요.',
      shouldContact: false,
    }
  }

  // 기타 에러
  return {
    error: 'UNKNOWN_ERROR',
    userMessage: 'AI 분석 중 오류가 발생했습니다. JOBIZIC 고객센터에 문의해주세요.',
    shouldContact: true,
  }
}

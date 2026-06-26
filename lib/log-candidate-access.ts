/**
 * Adam 접근 로그 기록
 *
 * Eve에서 후보자 정보에 접근할 때 Adam에 로그를 전송합니다.
 */

export async function logCandidateAccess(params: {
  headhunterEmail: string
  candidateEmail: string
  action: 'view' | 'export' | 'share' | 'contact'
  details?: any
}) {
  const ADAM_API_URL = process.env.ADAM_API_URL || 'https://jobizic.vercel.app'
  const API_KEY = process.env.EVE_TO_ADAM_API_KEY

  if (!API_KEY) {
    console.warn('[logCandidateAccess] EVE_TO_ADAM_API_KEY not configured')
    return
  }

  try {
    const response = await fetch(`${ADAM_API_URL}/api/audit/candidate-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        headhunter_email: params.headhunterEmail,
        candidate_email: params.candidateEmail,
        action: params.action,
        details: params.details || {}
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[logCandidateAccess] Failed:', error)
    } else {
      console.log(`[logCandidateAccess] ${params.headhunterEmail} → ${params.candidateEmail} (${params.action})`)
    }
  } catch (err) {
    console.error('[logCandidateAccess] Error:', err)
    // 에러가 발생해도 메인 기능은 계속 진행
  }
}

/**
 * 분석 안된 후보자 수 확인 및 재분석 비용 계산
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Claude API 가격 (Haiku 4.5)
const PRICING = {
  input: 0.80,  // $ per MTok (million tokens)
  output: 4.00, // $ per MTok
}

// 예상 토큰 사용량 (후보자 1명당)
const ESTIMATED_TOKENS = {
  input: 2000,   // 기존 정보 + raw_resume + prompt
  output: 1000,  // JSON 응답
}

async function main() {
  console.log('🔍 분석 안된 후보자 조회 중...\n')

  // 1. 전체 후보자 수
  const { count: totalCount } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 전체 후보자: ${totalCount}명\n`)

  // 2. raw_resume 없는 후보자 (재분석 불가)
  const { data: noRawResume, count: noRawResumeCount } = await supabase
    .from('candidates')
    .select('id, name', { count: 'exact' })
    .or('raw_resume.is.null,raw_resume.eq.')

  console.log(`❌ raw_resume 없음 (재분석 불가): ${noRawResumeCount}명`)

  // 3. 분석 안된 후보자 (재분석 대상)
  // raw_resume가 있지만 분석이 안된 경우
  const { data: allCandidates } = await supabase
    .from('candidates')
    .select('id, name, raw_resume, career_summary, skills, strength_summary')

  const unanalyzed = allCandidates?.filter(c => {
    const hasRawResume = c.raw_resume && c.raw_resume.trim() !== ''
    const noCareer = !c.career_summary || c.career_summary.trim() === ''
    const noSkills = !c.skills || c.skills.length === 0
    const noStrength = !c.strength_summary || c.strength_summary.trim() === ''

    return hasRawResume && (noCareer || noSkills || noStrength)
  }) || []

  const unanalyzedCount = unanalyzed.length

  console.log(`⚠️  분석 안됨 (재분석 대상): ${unanalyzedCount}명\n`)

  if (unanalyzedCount === 0) {
    console.log('✅ 모든 후보자가 이미 분석되어 있습니다!')
    return
  }

  // 4. 샘플 출력
  console.log('📋 샘플 (최대 10명):')
  console.log('='.repeat(80))
  unanalyzed.slice(0, 10).forEach((c, i) => {
    console.log(`${i + 1}. ${c.name || '이름 없음'}`)
    console.log(`   Career Summary: ${c.career_summary ? '✅' : '❌'}`)
    console.log(`   Skills: ${c.skills?.length || 0}개`)
    console.log(`   Strength: ${c.strength_summary ? '✅' : '❌'}`)
    console.log(`   Raw Resume: ${c.raw_resume ? `${c.raw_resume.length}자` : '❌'}`)
    console.log()
  })

  // 5. 비용 계산
  console.log('='.repeat(80))
  console.log('\n💰 재분석 비용 계산\n')

  const totalInputTokens = unanalyzedCount * ESTIMATED_TOKENS.input
  const totalOutputTokens = unanalyzedCount * ESTIMATED_TOKENS.output

  const inputCost = (totalInputTokens / 1_000_000) * PRICING.input
  const outputCost = (totalOutputTokens / 1_000_000) * PRICING.output
  const totalCost = inputCost + outputCost

  console.log(`📌 재분석 대상: ${unanalyzedCount}명`)
  console.log()
  console.log(`📥 Input Tokens:  ${totalInputTokens.toLocaleString()} (${(totalInputTokens / 1_000_000).toFixed(2)}M)`)
  console.log(`   단가: $${PRICING.input}/MTok`)
  console.log(`   비용: $${inputCost.toFixed(4)}`)
  console.log()
  console.log(`📤 Output Tokens: ${totalOutputTokens.toLocaleString()} (${(totalOutputTokens / 1_000_000).toFixed(2)}M)`)
  console.log(`   단가: $${PRICING.output}/MTok`)
  console.log(`   비용: $${outputCost.toFixed(4)}`)
  console.log()
  console.log(`💵 총 예상 비용: $${totalCost.toFixed(4)} (약 ${Math.ceil(totalCost * 1300)}원)`)
  console.log()

  // 6. 시나리오별 비용
  console.log('='.repeat(80))
  console.log('\n📊 시나리오별 비용\n')

  const scenarios = [
    { count: 10, label: '10명 테스트' },
    { count: 50, label: '50명 배치' },
    { count: 100, label: '100명 배치' },
    { count: unanalyzedCount, label: `전체 ${unanalyzedCount}명` },
  ]

  scenarios.forEach(({ count, label }) => {
    if (count > unanalyzedCount) return
    const cost = ((count * ESTIMATED_TOKENS.input / 1_000_000) * PRICING.input) +
                 ((count * ESTIMATED_TOKENS.output / 1_000_000) * PRICING.output)
    console.log(`${label.padEnd(20)} → $${cost.toFixed(4)} (약 ${Math.ceil(cost * 1300)}원)`)
  })

  console.log()
  console.log('='.repeat(80))
  console.log('\n💡 참고사항:')
  console.log('  - 위 비용은 예상치이며 실제 사용량에 따라 달라질 수 있습니다')
  console.log('  - raw_resume 길이가 길면 Input 비용 증가')
  console.log('  - 분석 결과가 상세하면 Output 비용 증가')
  console.log('  - Claude Haiku 4.5 모델 기준 ($0.80/MTok input, $4.00/MTok output)')
  console.log()
}

main().catch(err => {
  console.error('❌ 오류:', err)
  process.exit(1)
})

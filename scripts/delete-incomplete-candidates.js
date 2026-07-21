/**
 * 불완전한 후보자 삭제 스크립트
 *
 * 삭제 조건:
 * 1. (전화번호 AND 이메일 둘 다 없음) OR
 * 2. career_summary 없음
 *
 * 실행:
 * node scripts/delete-incomplete-candidates.js          # 조회만
 * node scripts/delete-incomplete-candidates.js --delete # 실제 삭제
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const DELETE_MODE = process.argv.includes('--delete')

// 삭제 제외 대상 (곽호용)
const EXCLUDE_IDS = ['b824fd92-b3f0-4b8f-b72f-2dfd97615df0']

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 불완전한 후보자 조회 중...\n')
  console.log('삭제 조건:')
  console.log('  1. (전화번호 AND 이메일 둘 다 없음) OR')
  console.log('  2. career_summary 없음\n')
  console.log('='.repeat(80))

  // 조회
  const { data, error, count } = await supabase
    .from('candidates')
    .select('id, name, email, phone, source, career_summary, skills, created_at', { count: 'exact' })
    .or('and(phone.is.null,email.is.null),career_summary.is.null')

  if (error) {
    console.error('❌ 조회 실패:', error.message)
    return
  }

  if (!data || data.length === 0) {
    console.log('\n✅ 삭제 대상 후보자가 없습니다.')
    return
  }

  // 제외 대상 필터링
  const filteredData = data.filter(c => !EXCLUDE_IDS.includes(c.id))
  const excludedCount = data.length - filteredData.length

  console.log(`\n📊 총 ${data.length}명 발견`)
  if (excludedCount > 0) {
    console.log(`⚠️  ${excludedCount}명 제외 (곽호용)\n`)
  } else {
    console.log()
  }

  // 목록 출력
  filteredData.forEach((c, i) => {
    const hasEmail = c.email && c.email.trim() !== ''
    const hasPhone = c.phone && c.phone.trim() !== ''
    const hasCareer = c.career_summary && c.career_summary.trim() !== ''

    console.log(`${i + 1}. ${c.name || '이름 없음'}`)
    console.log(`   ID: ${c.id}`)
    console.log(`   Email: ${hasEmail ? c.email : '❌ 없음'}`)
    console.log(`   Phone: ${hasPhone ? c.phone : '❌ 없음'}`)
    console.log(`   Source: ${c.source || '-'}`)
    console.log(`   Career: ${hasCareer ? '✅ 있음' : '❌ 없음'}`)
    console.log(`   Skills: ${c.skills?.length || 0}개`)
    console.log(`   등록: ${c.created_at}`)

    // 삭제 사유
    const reasons = []
    if (!hasEmail && !hasPhone) reasons.push('연락처 없음')
    if (!hasCareer) reasons.push('분석 없음')
    console.log(`   ⚠️  사유: ${reasons.join(', ')}`)
    console.log()
  })

  console.log('='.repeat(80))
  console.log(`\n📌 총 ${filteredData.length}명이 삭제 대상입니다.\n`)

  if (DELETE_MODE) {
    console.log('⚠️  DELETE 모드: 실제로 삭제합니다...\n')

    const ids = filteredData.map(c => c.id)

    const { error: deleteError, count: deletedCount } = await supabase
      .from('candidates')
      .delete({ count: 'exact' })
      .in('id', ids)

    if (deleteError) {
      console.error('❌ 삭제 실패:', deleteError.message)
      return
    }

    console.log(`✅ ${deletedCount}명 삭제 완료!`)
  } else {
    console.log('ℹ️  조회 모드입니다. 삭제하려면:')
    console.log('   node scripts/delete-incomplete-candidates.js --delete\n')
  }
}

main().catch(err => {
  console.error('❌ 오류:', err)
  process.exit(1)
})

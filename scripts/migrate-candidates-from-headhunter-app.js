/**
 * headhunter-app → Eve(jobizic_b2b) 후보자 데이터 마이그레이션
 *
 * 실행 방법:
 * node scripts/migrate-candidates-from-headhunter-app.js
 *
 * 환경변수 필요:
 * - SUPABASE_SERVICE_ROLE_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 */

// .env.local 로드
require('dotenv').config({ path: '.env.local' })

const Database = require('better-sqlite3')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// ============================================================
// 설정
// ============================================================

const HEADHUNTER_APP_DB_PATH = path.join(__dirname, '../../headhunter-app/public/data/candidates.db')
const DRY_RUN = process.argv.includes('--dry-run') // 테스트 모드

// Supabase 클라이언트
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================
// 데이터 변환 함수
// ============================================================

function transformCandidate(sourceCandidate) {
  const {
    id,
    name,
    email,
    phone,
    position,
    career,
    university,
    birth_date,
    last_salary,
    desired_salary,
    keywords,
    status,
    notes,
    resume_path,
    bizcard_analysis,
    career_direction,
    verify_grade,
    verify_summary,
    verify_date
  } = sourceCandidate

  // 키워드 파싱 (문자열 → 배열)
  const skillsArray = keywords
    ? keywords.split(/[,;\/]/).map(k => k.trim()).filter(Boolean)
    : []

  // 학력 배열 생성
  const educationArray = university ? [university] : []

  // career_direction JSON 파싱
  let careerDirectionObj = null
  try {
    careerDirectionObj = career_direction ? JSON.parse(career_direction) : null
  } catch (err) {
    console.warn(`[ID ${id}] career_direction 파싱 실패:`, err.message)
  }

  // Eve candidates 형식으로 변환
  return {
    // 기본 정보
    name: name || '이름 없음',
    email: email || null,
    phone: phone || null,
    location: null, // headhunter-app에 없음

    // 원본 이력서 (bizcard_analysis 또는 notes 활용)
    raw_resume: bizcard_analysis || notes || `[마이그레이션] 경력: ${career || '정보 없음'}`,
    source: 'Local', // headhunter-app (로컬 앱)

    // 파싱된 경력 정보
    current_company: null, // headhunter-app에 없음
    current_position: position || null,
    total_experience_years: null, // 계산 필요
    career_summary: career || null,
    education: educationArray,

    // 스킬 및 전문성
    skills: skillsArray,
    tech_stack: [],
    certifications: [],
    languages: [],

    // 희망 조건
    desired_position: position || null,
    desired_salary: desired_salary ? String(desired_salary) : null,
    desired_location: null,
    job_search_status: status === '진행중' ? '적극적' : '잠재적',

    // AI 분석 정보
    strength_summary: verify_summary || null,
    career_trajectory: careerDirectionObj?.summary || null,
    ideal_roles: careerDirectionObj?.roles || [],
    market_value: verify_grade || null,
    key_highlights: [],

    // 헤드헌터 메모
    headhunter_notes: notes || null,
    tags: ['Local', '마이그레이션'],

    // 상태 관리
    status: mapStatus(status),

    // 연락 이력
    last_contacted_at: null,
    contact_count: 0,

    // 추가 메타데이터
    metadata: {
      imported_from: 'Local', // headhunter-app
      original_id: id,
      imported_at: new Date().toISOString(),
      original_data: {
        birth_date,
        last_salary,
        resume_path,
        verify_date
      }
    }
  }
}

// 상태 매핑
function mapStatus(sourceStatus) {
  const statusMap = {
    '진행중': '활성',
    '검토중': '검토중',
    '제안중': '제안중',
    '합격': '합격',
    '보류': '보류',
    '종료': '아카이브',
    '탈락': '아카이브'
  }
  return statusMap[sourceStatus] || '검토중'
}

// ============================================================
// 마이그레이션 실행
// ============================================================

async function migrate() {
  console.log('🚀 headhunter-app → Eve 후보자 데이터 마이그레이션 시작')
  console.log('=' .repeat(60))

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN 모드: 실제로 데이터를 insert하지 않습니다')
  }

  // 1. SQLite 데이터베이스 연결
  console.log('\n1️⃣  SQLite 데이터베이스 연결 중...')
  let db
  try {
    db = new Database(HEADHUNTER_APP_DB_PATH, { readonly: true })
    console.log('✅ 연결 성공:', HEADHUNTER_APP_DB_PATH)
  } catch (err) {
    console.error('❌ 연결 실패:', err.message)
    process.exit(1)
  }

  // 2. 후보자 데이터 조회
  console.log('\n2️⃣  후보자 데이터 조회 중...')
  const sourceCandidates = db.prepare('SELECT * FROM candidates').all()
  console.log(`✅ 총 ${sourceCandidates.length}명의 후보자 발견`)

  if (sourceCandidates.length === 0) {
    console.log('⚠️  마이그레이션할 데이터가 없습니다.')
    db.close()
    return
  }

  // 3. 기존 Local 데이터 확인 (중복 방지)
  console.log('\n3️⃣  기존 마이그레이션 데이터 확인 중...')
  const { data: existingCandidates, error: checkError } = await supabase
    .from('candidates')
    .select('metadata')
    .eq('source', 'Local')

  if (checkError) {
    console.error('❌ 기존 데이터 확인 실패:', checkError.message)
  } else {
    const existingIds = existingCandidates
      .map(c => c.metadata?.original_id)
      .filter(Boolean)
    console.log(`ℹ️  기존 마이그레이션 데이터: ${existingIds.length}명`)

    if (existingIds.length > 0) {
      console.log(`⚠️  중복 확인: 기존 ID ${existingIds.slice(0, 5).join(', ')}...`)
    }
  }

  // 4. 데이터 변환 및 insert
  console.log('\n4️⃣  데이터 변환 및 마이그레이션 중...')
  const results = {
    success: 0,
    skipped: 0,
    failed: 0,
    errors: []
  }

  for (const sourceCandidate of sourceCandidates) {
    const { id, name, email } = sourceCandidate

    try {
      // 이메일 중복 확인 (이메일이 있는 경우)
      if (email) {
        const { data: duplicateCheck } = await supabase
          .from('candidates')
          .select('id, source')
          .eq('email', email)
          .single()

        if (duplicateCheck) {
          console.log(`⏭️  [ID ${id}] 스킵 (이메일 중복: ${email}, source: ${duplicateCheck.source})`)
          results.skipped++
          continue
        }
      }

      // 데이터 변환
      const transformed = transformCandidate(sourceCandidate)

      // DRY RUN 모드
      if (DRY_RUN) {
        console.log(`\n📋 [ID ${id}] ${name} (${email || '이메일 없음'})`)
        console.log('   변환된 데이터:', JSON.stringify(transformed, null, 2))
        results.success++
        continue
      }

      // Supabase insert
      const { data, error } = await supabase
        .from('candidates')
        .insert(transformed)
        .select()
        .single()

      if (error) {
        console.error(`❌ [ID ${id}] 실패:`, error.message)
        results.failed++
        results.errors.push({ id, name, error: error.message })
      } else {
        console.log(`✅ [ID ${id}] ${name} → Eve ID: ${data.id}`)
        results.success++
      }

    } catch (err) {
      console.error(`❌ [ID ${id}] 예외 발생:`, err.message)
      results.failed++
      results.errors.push({ id, name, error: err.message })
    }
  }

  // 5. 결과 요약
  console.log('\n' + '='.repeat(60))
  console.log('📊 마이그레이션 결과 요약')
  console.log('='.repeat(60))
  console.log(`✅ 성공: ${results.success}명`)
  console.log(`⏭️  스킵 (중복): ${results.skipped}명`)
  console.log(`❌ 실패: ${results.failed}명`)
  console.log(`📝 총 처리: ${sourceCandidates.length}명`)

  if (results.errors.length > 0) {
    console.log('\n⚠️  실패 항목:')
    results.errors.forEach(({ id, name, error }) => {
      console.log(`  - [ID ${id}] ${name}: ${error}`)
    })
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN 모드였습니다. 실제로 데이터가 insert되지 않았습니다.')
    console.log('   실제 마이그레이션: node scripts/migrate-candidates-from-headhunter-app.js')
  }

  // 6. 데이터베이스 연결 종료
  db.close()
  console.log('\n✅ 마이그레이션 완료!')
}

// ============================================================
// 실행
// ============================================================

migrate().catch(err => {
  console.error('\n❌ 마이그레이션 중 오류 발생:', err)
  process.exit(1)
})

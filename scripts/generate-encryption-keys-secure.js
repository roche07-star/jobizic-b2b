#!/usr/bin/env node

/**
 * 🔐 암호화 키 생성 (보안 강화 버전)
 *
 * 화면에 키를 출력하지 않고 .env.local에만 저장
 */

const crypto = require('crypto')
const fs = require('fs')

console.log('🔐 암호화 키 생성 중...\n')

// 키 생성
const encryptionKey = crypto.randomBytes(32).toString('base64')
const encryptionSalt = crypto.randomBytes(16).toString('base64')

console.log('✅ 생성 완료!\n')

// .env.local 파일에만 저장 (화면 출력 안 함)
const envContent = `# 암호화 키 (자동 생성)
# ⚠️ 절대 Git에 커밋하지 마세요!
# 생성일: ${new Date().toISOString()}

ENCRYPTION_KEY=${encryptionKey}
ENCRYPTION_SALT=${encryptionSalt}
`

try {
  // 기존 파일 백업
  if (fs.existsSync('.env.local')) {
    const backupName = `.env.local.backup.${Date.now()}`
    fs.copyFileSync('.env.local', backupName)
    console.log(`📦 기존 .env.local을 ${backupName}으로 백업했습니다.`)
  }

  // 새 파일 작성 (600 권한)
  fs.writeFileSync('.env.local', envContent, { mode: 0o600 })
  console.log('✅ .env.local 파일이 생성되었습니다!\n')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔒 보안 모드')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('✅ 키가 화면에 출력되지 않았습니다.')
  console.log('✅ .env.local 파일에만 저장되었습니다.')
  console.log('✅ 파일 권한: 600 (사용자만 읽기 가능)\n')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 Vercel 배포 시:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('방법 1: 파일에서 복사')
  console.log('  cat .env.local')
  console.log('  → Vercel Dashboard에 붙여넣기\n')

  console.log('방법 2: Vercel CLI 사용 (권장)')
  console.log('  vercel env pull .env.local')
  console.log('  vercel env add ENCRYPTION_KEY')
  console.log('  vercel env add ENCRYPTION_SALT\n')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  보안 주의사항:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('1. .env.local을 안전한 곳에 백업하세요 (Password Manager)')
  console.log('2. 화면 공유 중에는 .env.local을 열지 마세요')
  console.log('3. 터미널 히스토리를 클리어하세요: history -c')
  console.log('4. 키를 분실하면 복호화할 수 없습니다\n')

  console.log('🎉 설정 완료! npm run dev로 테스트하세요.\n')
} catch (error) {
  console.error('❌ 파일 생성 실패:', error.message)
  process.exit(1)
}

#!/usr/bin/env node

/**
 * 🔐 암호화 키 생성 스크립트
 *
 * AES-256-GCM 암호화에 필요한 키와 Salt 생성
 *
 * 사용법:
 *   node scripts/generate-encryption-keys.js
 */

const crypto = require('crypto')

console.log('🔐 암호화 키 생성 중...\n')

// 1. ENCRYPTION_KEY 생성 (32 bytes = 256 bits for AES-256)
const encryptionKey = crypto.randomBytes(32).toString('base64')

// 2. ENCRYPTION_SALT 생성 (16 bytes)
const encryptionSalt = crypto.randomBytes(16).toString('base64')

console.log('✅ 생성 완료!\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📋 아래 내용을 .env.local에 추가하세요:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log(`ENCRYPTION_KEY=${encryptionKey}`)
console.log(`ENCRYPTION_SALT=${encryptionSalt}\n`)

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('☁️  Vercel 배포 시:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log('1. Vercel Dashboard → Settings → Environment Variables')
console.log('2. 위의 두 변수를 추가:')
console.log(`   - ENCRYPTION_KEY: ${encryptionKey}`)
console.log(`   - ENCRYPTION_SALT: ${encryptionSalt}\n`)

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('⚠️  보안 주의사항:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log('1. 이 키를 절대 Git에 커밋하지 마세요!')
console.log('2. .env.local은 .gitignore에 포함되어 있습니다.')
console.log('3. 키를 분실하면 기존 암호화 데이터를 복호화할 수 없습니다.')
console.log('4. 키를 안전한 곳에 백업하세요 (Password Manager 등).\n')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('💡 다음 단계:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log('1. 위의 키를 .env.local에 추가')
console.log('2. npm run dev로 로컬 테스트')
console.log('3. Vercel에 환경 변수 설정')
console.log('4. git push로 배포\n')

// .env.local 파일 자동 생성 (선택)
const readline = require('readline')
const fs = require('fs')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.question('\n❓ .env.local 파일을 자동으로 생성할까요? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    const envContent = `# 암호화 키 (자동 생성)
# ⚠️ 절대 Git에 커밋하지 마세요!
# 생성일: ${new Date().toISOString()}

ENCRYPTION_KEY=${encryptionKey}
ENCRYPTION_SALT=${encryptionSalt}
`

    try {
      // 기존 .env.local이 있으면 백업
      if (fs.existsSync('.env.local')) {
        const backupName = `.env.local.backup.${Date.now()}`
        fs.copyFileSync('.env.local', backupName)
        console.log(`\n✅ 기존 .env.local을 ${backupName}으로 백업했습니다.`)
      }

      // 새 파일 작성
      fs.writeFileSync('.env.local', envContent)
      console.log('✅ .env.local 파일이 생성되었습니다!\n')

      console.log('🎉 설정 완료! npm run dev로 테스트하세요.\n')
    } catch (error) {
      console.error('❌ 파일 생성 실패:', error.message)
      console.log('\n수동으로 .env.local 파일을 생성하세요.\n')
    }
  } else {
    console.log('\n👍 수동으로 .env.local에 추가하세요.\n')
  }

  rl.close()
})

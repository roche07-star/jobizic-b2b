/**
 * 🔐 데이터 암호화/복호화
 *
 * AES-256-GCM 알고리즘 사용
 * 민감 정보 (이메일, 전화번호 등) 암호화
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// 암호화 키 (환경 변수에서 로드)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32bytes!'
const ALGORITHM = 'aes-256-gcm'

/**
 * 암호화 키 검증
 */
function validateKey(): void {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('⚠️ ENCRYPTION_KEY not set. Using default key (NOT SAFE FOR PRODUCTION)')
  }

  if (ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }
}

/**
 * 암호화 키 생성 (scrypt)
 */
function deriveKey(): Buffer {
  // Salt는 고정 (환경 변수로 설정 가능)
  const salt = process.env.ENCRYPTION_SALT || 'nexhire-encryption-salt'
  return scryptSync(ENCRYPTION_KEY, salt, 32)
}

/**
 * 데이터 암호화
 *
 * @param text - 암호화할 텍스트
 * @returns 암호화된 문자열 (iv:authTag:encrypted 형식)
 */
export function encrypt(text: string | null | undefined): string | null {
  if (!text) return null

  validateKey()

  try {
    const key = deriveKey()
    const iv = randomBytes(16)
    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // iv:authTag:encrypted 형식으로 반환
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('[Encryption] Error:', error)
    throw new Error('암호화 실패')
  }
}

/**
 * 데이터 복호화
 *
 * @param encryptedText - 암호화된 문자열 (iv:authTag:encrypted 형식)
 * @returns 복호화된 텍스트
 */
export function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null

  validateKey()

  try {
    const key = deriveKey()
    const parts = encryptedText.split(':')

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('[Decryption] Error:', error)
    throw new Error('복호화 실패')
  }
}

/**
 * 이메일 암호화 (+ 검색 가능한 해시)
 *
 * 검색을 위해 해시도 함께 생성
 */
export function encryptEmail(email: string | null): {
  encrypted: string | null
  hash: string | null
} {
  if (!email) return { encrypted: null, hash: null }

  const encrypted = encrypt(email)
  const hash = hashForSearch(email)

  return { encrypted, hash }
}

/**
 * 검색용 해시 생성 (SHA-256)
 *
 * 암호화된 데이터를 검색하기 위한 해시
 */
function hashForSearch(text: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(text).digest('hex')
}

/**
 * 전화번호 암호화
 */
export function encryptPhone(phone: string | null): string | null {
  return encrypt(phone)
}

/**
 * 전화번호 복호화
 */
export function decryptPhone(encryptedPhone: string | null): string | null {
  return decrypt(encryptedPhone)
}

/**
 * 마스킹 (부분 표시)
 *
 * 이메일: t***@example.com
 * 전화번호: 010-****-5678
 */
export function maskEmail(email: string | null): string | null {
  if (!email) return null

  const [local, domain] = email.split('@')
  if (!local || !domain) return email

  const masked = local.charAt(0) + '***'
  return `${masked}@${domain}`
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null

  // 010-1234-5678 → 010-****-5678
  const cleaned = phone.replace(/[^0-9]/g, '')

  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 3)}-****-${cleaned.substring(7)}`
  }

  return phone
}

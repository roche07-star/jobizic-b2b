/**
 * 🔐 암호화 테스트
 */

import { encrypt, decrypt, maskEmail, maskPhone, encryptEmail } from '../encryption'

describe('암호화/복호화', () => {
  describe('기본 암호화', () => {
    it('텍스트를 암호화하고 복호화', () => {
      const original = 'test@example.com'
      const encrypted = encrypt(original)
      const decrypted = decrypt(encrypted)

      expect(encrypted).not.toBe(original) // 암호화됨
      expect(encrypted).toContain(':') // iv:authTag:encrypted 형식
      expect(decrypted).toBe(original) // 복호화 성공
    })

    it('null 입력은 null 반환', () => {
      expect(encrypt(null)).toBeNull()
      expect(decrypt(null)).toBeNull()
    })

    it('빈 문자열은 null 반환', () => {
      const encrypted = encrypt('')
      expect(encrypted).toBeNull()
    })
  })

  describe('이메일 암호화', () => {
    it('이메일 암호화 + 해시', () => {
      const email = 'hong@example.com'
      const { encrypted, hash } = encryptEmail(email)

      expect(encrypted).not.toBeNull()
      expect(hash).not.toBeNull()
      expect(hash).toMatch(/^[a-f0-9]{64}$/) // SHA-256 해시 형식
    })

    it('같은 이메일은 같은 해시', () => {
      const email = 'test@example.com'
      const result1 = encryptEmail(email)
      const result2 = encryptEmail(email)

      expect(result1.hash).toBe(result2.hash) // 해시는 동일
      // 암호화는 iv가 다르므로 다름
    })
  })

  describe('마스킹', () => {
    it('이메일 마스킹', () => {
      expect(maskEmail('hong@example.com')).toBe('h***@example.com')
      expect(maskEmail('test@test.com')).toBe('t***@test.com')
      expect(maskEmail(null)).toBeNull()
    })

    it('전화번호 마스킹', () => {
      expect(maskPhone('01012345678')).toBe('010-****-5678')
      expect(maskPhone('010-1234-5678')).toBe('010-****-5678')
      expect(maskPhone(null)).toBeNull()
    })
  })

  describe('보안', () => {
    it('같은 텍스트도 매번 다르게 암호화 (IV 랜덤)', () => {
      const text = 'secret'
      const encrypted1 = encrypt(text)
      const encrypted2 = encrypt(text)

      expect(encrypted1).not.toBe(encrypted2) // IV가 다름
      expect(decrypt(encrypted1)).toBe(text)
      expect(decrypt(encrypted2)).toBe(text)
    })

    it('잘못된 형식은 복호화 실패', () => {
      expect(() => decrypt('invalid')).toThrow()
      expect(() => decrypt('a:b')).toThrow() // 3개 부분 필요
    })
  })
})

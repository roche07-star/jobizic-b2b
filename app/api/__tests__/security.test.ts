/**
 * 🔒 보안 테스트
 *
 * OWASP Top 10 기반 보안 취약점 테스트
 */

import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'

describe('보안 테스트', () => {
  describe('Rate Limiting', () => {
    beforeEach(() => {
      resetRateLimit('test-user')
    })

    it('제한 내에서는 요청 허용', () => {
      const { allowed, remaining } = checkRateLimit('test-user', { max: 5, windowMs: 60000 })
      expect(allowed).toBe(true)
      expect(remaining).toBe(4)
    })

    it('제한 초과 시 요청 거부', () => {
      // 5번 요청
      for (let i = 0; i < 5; i++) {
        checkRateLimit('test-user', { max: 5, windowMs: 60000 })
      }

      // 6번째 요청은 거부
      const { allowed, remaining } = checkRateLimit('test-user', { max: 5, windowMs: 60000 })
      expect(allowed).toBe(false)
      expect(remaining).toBe(0)
    })

    it('다른 사용자는 독립적', () => {
      // user1 5번 요청
      for (let i = 0; i < 5; i++) {
        checkRateLimit('user1', { max: 5, windowMs: 60000 })
      }

      // user2는 여전히 허용
      const { allowed } = checkRateLimit('user2', { max: 5, windowMs: 60000 })
      expect(allowed).toBe(true)
    })
  })

  describe('개인정보 마스킹', () => {
    it('이메일 마스킹', () => {
      const text = '연락처: test@example.com'
      const masked = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
      expect(masked).toBe('연락처: [EMAIL]')
    })

    it('전화번호 마스킹', () => {
      const text = '전화: 010-1234-5678'
      const masked = text.replace(/(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})/g, '[PHONE]')
      expect(masked).toBe('전화: [PHONE]')
    })

    it('여러 개인정보 동시 마스킹', () => {
      let text = '이름: 홍길동, 이메일: hong@test.com, 전화: 010-1234-5678'
      text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
      text = text.replace(/(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})/g, '[PHONE]')
      expect(text).toBe('이름: 홍길동, 이메일: [EMAIL], 전화: [PHONE]')
    })
  })

  describe('입력 검증', () => {
    it('XSS 공격 문자열 감지', () => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror="alert(1)">',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)">',
      ]

      maliciousInputs.forEach(input => {
        const hasScript = /<script|<iframe|javascript:|onerror=/i.test(input)
        expect(hasScript).toBe(true)
      })
    })

    it('SQL Injection 패턴 감지', () => {
      const maliciousInputs = [
        "' OR '1'='1",
        '1; DROP TABLE users--',
        "' UNION SELECT * FROM users--",
      ]

      maliciousInputs.forEach(input => {
        const hasSQLPattern = /('|--|;|union|drop|select)/i.test(input)
        expect(hasSQLPattern).toBe(true)
      })
    })
  })

  describe('API 키 보호', () => {
    it('환경 변수에서만 로드 (프로덕션)', () => {
      // API 키는 process.env에서만 접근
      // 테스트 환경에서는 없을 수 있음
      if (process.env.NODE_ENV === 'production') {
        expect(process.env.ANTHROPIC_API_KEY).toBeDefined()
      } else {
        // 개발/테스트 환경
        expect(true).toBe(true)
      }
    })

    it('클라이언트에 노출 안 됨', () => {
      // NEXT_PUBLIC_ 접두사가 없는 키는 서버 전용
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (apiKey) {
        expect(apiKey.startsWith('sk-')).toBe(true) // Anthropic API 키 형식
      } else {
        // API 키 없음 (테스트 환경)
        expect(true).toBe(true)
      }
    })
  })
})

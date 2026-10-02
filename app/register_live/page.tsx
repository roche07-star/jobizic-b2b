'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterLivePage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: name,
          phone
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '회원가입에 실패했습니다.')
      }

      setSuccess(true)

      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        router.push('/login')
      }, 3000)

    } catch (err: any) {
      setError(err.message || '회원가입에 실패했습니다.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '24px'
      }}>
        <div className="card" style={{ width: 420, maxWidth: '100%', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
            회원가입 완료!
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 24 }}>
            관리자 승인 후 로그인 가능합니다.
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            잠시 후 로그인 페이지로 이동합니다...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px'
    }}>
      <div className="card" style={{ width: 420, maxWidth: '100%', padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--accent)',
            letterSpacing: 1,
            marginBottom: 8
          }}>
            JOBIZIC <span style={{ color: 'var(--text)', fontWeight: 300 }}>biz</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted2)' }}>
            AI 헤드헌터 플랫폼 회원가입
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">이름</label>
            <input
              type="text"
              className="form-input"
              placeholder="홍길동"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">이메일</label>
            <input
              type="email"
              className="form-input"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">전화번호</label>
            <input
              type="tel"
              className="form-input"
              placeholder="010-1234-5678"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">비밀번호</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingRight: 45 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: 12,
                  color: 'var(--muted2)',
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted2)'}
              >
                {showPassword ? '숨기기' : '보기'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              최소 6자 이상
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(255,107,107,0.1)',
              border: '1px solid rgba(255,107,107,0.3)',
              color: 'var(--danger)',
              fontSize: 13,
              marginBottom: 20
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? <><div className="spinner" /> 가입 중...</> : '회원가입'}
          </button>
        </form>

        <div style={{
          marginTop: 24,
          paddingTop: 24,
          borderTop: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--muted2)',
          textAlign: 'center'
        }}>
          이미 계정이 있으신가요?{' '}
          <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            로그인
          </a>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await signIn(email, password)
      // 완전한 새로고침으로 모든 캐시 클리어
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.')
      setLoading(false)
    }
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
            AI 헤드헌터 플랫폼
          </div>
        </div>

        <form onSubmit={handleSubmit}>
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

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">비밀번호</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
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
            {loading ? <><div className="spinner" /> 로그인 중...</> : '로그인'}
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
          계정이 없으신가요? 관리자에게 문의하세요.
        </div>
      </div>
    </div>
  )
}

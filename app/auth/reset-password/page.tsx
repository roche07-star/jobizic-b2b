'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) throw updateError

      alert('✅ 비밀번호가 재설정되었습니다! 새 비밀번호로 로그인하세요.')
      
      // 로그아웃 후 로그인 페이지로
      await supabase.auth.signOut()
      router.push('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page" style={{ maxWidth: 500, margin: '0 auto', paddingTop: 80 }}>
      <div className="card">
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>비밀번호 재설정</h1>
        <p style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 24 }}>
          새로운 비밀번호를 설정하세요
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">새 비밀번호</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="최소 6자 이상"
              required
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">비밀번호 확인</label>
            <input
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 재입력"
              required
            />
          </div>

          {error && (
            <div style={{
              padding: 12,
              background: 'rgba(255,107,107,0.1)',
              border: '1px solid var(--danger)',
              borderRadius: 8,
              marginBottom: 16,
              color: 'var(--danger)',
              fontSize: 13
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? '재설정 중...' : '🔒 비밀번호 재설정'}
          </button>
        </form>
      </div>
    </main>
  )
}

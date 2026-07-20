'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)

  // 세션 확인 및 Fragment 처리 (비밀번호 찾기 이메일 링크)
  useEffect(() => {
    async function checkSession() {
      const supabase = getSupabaseBrowser()

      // URL fragment에서 토큰 추출
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        console.log('[RESET PASSWORD] Processing fragment tokens')
        const params = new URLSearchParams(hash.substring(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')

        if (access_token && refresh_token) {
          // 명시적으로 세션 설정
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token
          })

          if (error) {
            console.error('[RESET PASSWORD] setSession error:', error)
            setError('세션 생성 실패. 비밀번호 재설정 링크를 다시 확인해주세요.')
            setSessionChecked(true)
            return
          }

          console.log('[RESET PASSWORD] Session set from fragment')
          // Fragment 제거
          window.history.replaceState({}, '', '/auth/reset-password')
          setSessionChecked(true)
          return
        }
      }

      // 일반 세션 확인
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        console.error('[RESET PASSWORD] No session found')
        setError('로그인이 필요합니다. 비밀번호 재설정 링크를 통해 접근해주세요.')
        setSessionChecked(true)
        return
      }

      console.log('[RESET PASSWORD] Session found:', session.user.email)
      setSessionChecked(true)
    }

    checkSession()
  }, [])

  // 세션 확인 전에는 로딩 표시
  if (!sessionChecked) {
    return (
      <main className="page" style={{ maxWidth: 500, margin: '0 auto', paddingTop: 80 }}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--muted2)' }}>로딩 중...</p>
        </div>
      </main>
    )
  }

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
      const { error: updateError } = await getSupabaseBrowser().auth.updateUser({
        password: password,
      })

      if (updateError) throw updateError

      alert('✅ 비밀번호가 재설정되었습니다! 새 비밀번호로 로그인하세요.')
      
      // 로그아웃 후 로그인 페이지로
      await getSupabaseBrowser().auth.signOut()
      router.push('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 세션 없으면 에러 메시지만 표시
  if (error && !password && !confirmPassword) {
    return (
      <main className="page" style={{ maxWidth: 500, margin: '0 auto', paddingTop: 80 }}>
        <div className="card">
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>비밀번호 재설정</h1>
          <div style={{
            padding: 16,
            background: 'rgba(255,107,107,0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 8,
            marginBottom: 16,
            color: 'var(--danger)',
            fontSize: 14
          }}>
            {error}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/login')}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            로그인 페이지로 이동
          </button>
        </div>
      </main>
    )
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
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="최소 6자 이상"
                required
                autoFocus
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
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">비밀번호 확인</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 재입력"
                required
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

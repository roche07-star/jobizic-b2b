'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // 세션 확인 및 Fragment 처리
  useEffect(() => {
    async function checkSession() {
      const supabase = getSupabaseBrowser()

      // URL fragment에서 토큰 추출
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        console.log('[SET PASSWORD] Processing fragment tokens')
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
            console.error('[SET PASSWORD] setSession error:', error)
            router.push('/')
            return
          }

          console.log('[SET PASSWORD] Session set from fragment')
          // Fragment 제거
          window.history.replaceState({}, '', '/auth/set-password')
          setSessionChecked(true)
          return
        }
      }

      // 일반 세션 확인
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        console.error('[SET PASSWORD] No session found, redirecting to login')
        router.push('/')
        return
      }

      console.log('[SET PASSWORD] Session found:', session.user.email)
      setSessionChecked(true)
    }

    checkSession()
  }, [])

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
      // 비밀번호 설정
      const { error: updateError } = await getSupabaseBrowser().auth.updateUser({
        password: password,
      })

      if (updateError) throw updateError

      // profiles 테이블의 password_set을 true로 변경
      const { data: { user } } = await getSupabaseBrowser().auth.getUser()
      if (user) {
        await getSupabaseBrowser()
          .from('profiles')
          .update({ password_set: true })
          .eq('id', user.id)
      }

      alert('✅ 비밀번호가 설정되었습니다!\n\n새 비밀번호로 다시 로그인해주세요.')

      // 로그아웃 처리
      await getSupabaseBrowser().auth.signOut()

      // 로그인 페이지로 직접 이동 (무한루프 방지)
      window.location.replace('/login')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <main className="page" style={{ maxWidth: 500, margin: '0 auto', paddingTop: 80 }}>
      <div className="card">
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>비밀번호 설정</h1>
        <p style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 24 }}>
          계정 활성화를 위해 비밀번호를 설정하세요
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">비밀번호</label>
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
            {loading ? '설정 중...' : '✅ 비밀번호 설정'}
          </button>
        </form>
      </div>
    </main>
  )
}

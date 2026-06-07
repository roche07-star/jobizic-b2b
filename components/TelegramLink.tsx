'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'

export default function TelegramLink() {
  const [profile, setProfile] = useState<any>(null)
  const [linkCode, setLinkCode] = useState('')
  const [deepLink, setDeepLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)

  useEffect(() => {
    getProfile().then(setProfile)
  }, [])

  useEffect(() => {
    if (!expiresAt) return

    const timer = setInterval(() => {
      if (new Date() > expiresAt) {
        setLinkCode('')
        setDeepLink('')
        setExpiresAt(null)
        setError('코드가 만료되었습니다. 새로 발급해주세요.')
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt])

  async function generateCode() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/telegram/link/create', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.alreadyLinked) {
          setError('이미 텔레그램이 연동되어 있습니다.')
          // 페이지 새로고침하여 연동 상태 업데이트
          setTimeout(() => window.location.reload(), 2000)
        } else {
          setError(data.error || '코드 생성에 실패했습니다.')
        }
        return
      }

      setLinkCode(data.code)
      setDeepLink(data.deepLink)
      setExpiresAt(new Date(data.expiresAt))

      // Deep Link 자동 열기
      window.open(data.deepLink, '_blank')
    } catch (err) {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const remainingSeconds = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
    : 0

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  // 이미 연동된 경우
  if (profile?.telegram_chat_id) {
    return (
      <div style={{
        padding: 20,
        border: '1px solid #22c55e',
        borderRadius: 8,
        backgroundColor: '#f0fdf4',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 24 }}>✅</span>
          <h3 style={{ margin: 0, color: '#16a34a' }}>텔레그램 연동 완료</h3>
        </div>
        <p style={{ margin: '8px 0', color: '#15803d' }}>
          {profile.telegram_username && `@${profile.telegram_username} 으로 연동되었습니다.`}
        </p>
        <p style={{ margin: '8px 0', fontSize: 14, color: '#166534' }}>
          이제 실시간 알림을 받을 수 있습니다! 🎉
        </p>
      </div>
    )
  }

  return (
    <div style={{
      padding: 20,
      border: '1px solid var(--border)',
      borderRadius: 8,
      backgroundColor: 'var(--bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>🤖</span>
        <h3 style={{ margin: 0 }}>텔레그램 연동</h3>
      </div>

      <p style={{ margin: '12px 0', fontSize: 14, color: 'var(--muted2)' }}>
        텔레그램으로 실시간 알림을 받아보세요!
      </p>

      {!linkCode ? (
        <>
          <ul style={{ margin: '12px 0 16px 20px', fontSize: 14, color: 'var(--muted2)' }}>
            <li>신규 JD 알림</li>
            <li>채용 프로세스 변경 알림</li>
            <li>모닝 브리핑 (매일 오전 9시)</li>
          </ul>

          <button
            onClick={generateCode}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? '#ccc' : 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 15,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            {loading ? '처리 중...' : '🚀 텔레그램 연동하기'}
          </button>
        </>
      ) : (
        <div style={{
          padding: 16,
          backgroundColor: '#f3f4f6',
          borderRadius: 6,
          marginTop: 12,
        }}>
          <p style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
            📱 텔레그램 앱이 자동으로 열렸습니다!
          </p>

          <div style={{
            padding: 12,
            backgroundColor: 'white',
            borderRadius: 4,
            marginBottom: 12,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>연동 코드</div>
            <div style={{
              fontSize: 28,
              fontWeight: 'bold',
              letterSpacing: 4,
              color: '#1f2937',
              fontFamily: 'monospace',
            }}>
              {linkCode}
            </div>
          </div>

          <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#666' }}>
            ⏱️ 남은 시간: <strong>{minutes}:{seconds.toString().padStart(2, '0')}</strong>
          </p>

          <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#888' }}>
            앱이 열리지 않았다면:
          </p>

          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: '10px 16px',
              backgroundColor: '#0088cc',
              color: 'white',
              textAlign: 'center',
              borderRadius: 4,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            📲 텔레그램에서 열기
          </a>

          <button
            onClick={() => {
              setLinkCode('')
              setDeepLink('')
              setExpiresAt(null)
            }}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 13,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            취소
          </button>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 12,
          padding: 12,
          backgroundColor: '#fee',
          borderRadius: 4,
          color: '#c00',
          fontSize: 14,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

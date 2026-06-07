'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function TelegramAdminPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const p = await getProfile()
    if (!p || p.role !== 'admin') {
      router.push('/')
      return
    }
    setProfile(p)
    checkStatus()
  }

  async function checkStatus() {
    try {
      const res = await fetch('/api/telegram/setup')
      const data = await res.json()
      setStatus(data)
    } catch (err) {
      console.error('Status check error:', err)
    }
  }

  async function setupWebhook() {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/telegram/setup', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '설정에 실패했습니다.')
        return
      }

      setResult(data)
      await checkStatus()
    } catch (err) {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!profile) {
    return <div style={{ padding: 40, textAlign: 'center' }}>로딩 중...</div>
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
      <h1 style={{ marginBottom: 8 }}>🤖 텔레그램 봇 관리</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>관리자 전용 페이지</p>

      {/* 현재 상태 */}
      {status && (
        <div style={{
          padding: 20,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          marginBottom: 24,
          backgroundColor: status.configured ? '#f0fdf4' : '#fef3f2',
        }}>
          <h3 style={{ margin: '0 0 12px 0' }}>
            {status.configured ? '✅ 설정 완료' : '⚠️ 설정 필요'}
          </h3>
          {status.botInfo && (
            <div style={{ fontSize: 14, color: '#666' }}>
              <p style={{ margin: '4px 0' }}>봇 이름: <strong>{status.botInfo.first_name}</strong></p>
              <p style={{ margin: '4px 0' }}>Username: <strong>@{status.botInfo.username}</strong></p>
            </div>
          )}
          {status.webhookUrl && (
            <p style={{ margin: '8px 0 4px 0', fontSize: 13, color: '#888' }}>
              Webhook URL: {status.webhookUrl}
            </p>
          )}
          {!status.configured && (
            <p style={{ margin: '12px 0 0 0', fontSize: 14, color: '#dc2626' }}>
              {status.message}
            </p>
          )}
        </div>
      )}

      {/* 설정 버튼 */}
      <div style={{
        padding: 20,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        marginBottom: 24,
      }}>
        <h3 style={{ margin: '0 0 12px 0' }}>Webhook 설정</h3>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
          텔레그램 봇과 서버를 연결합니다. 이 작업은 한 번만 실행하면 됩니다.
        </p>

        <button
          onClick={setupWebhook}
          disabled={loading}
          style={{
            padding: '12px 24px',
            backgroundColor: loading ? '#ccc' : '#0088cc',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '설정 중...' : '🚀 Webhook 설정하기'}
        </button>
      </div>

      {/* 결과 */}
      {result && (
        <div style={{
          padding: 20,
          border: '1px solid #22c55e',
          borderRadius: 8,
          marginBottom: 24,
          backgroundColor: '#f0fdf4',
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#16a34a' }}>✅ 설정 완료!</h3>

          {result.botInfo && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>봇 정보</h4>
              <pre style={{
                padding: 12,
                backgroundColor: 'white',
                borderRadius: 4,
                fontSize: 12,
                overflow: 'auto',
              }}>
                {JSON.stringify(result.botInfo, null, 2)}
              </pre>
            </div>
          )}

          <div style={{ fontSize: 14 }}>
            <p style={{ margin: '4px 0' }}>
              ✅ Webhook: {result.webhook ? '설정 완료' : '실패'}
            </p>
            <p style={{ margin: '4px 0' }}>
              ✅ 명령어: {result.commands ? '등록 완료' : '실패'}
            </p>
          </div>

          {result.warning && (
            <p style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: '#fef3f2',
              borderRadius: 4,
              fontSize: 13,
              color: '#dc2626',
            }}>
              ⚠️ {result.warning}
            </p>
          )}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div style={{
          padding: 20,
          border: '1px solid #ef4444',
          borderRadius: 8,
          marginBottom: 24,
          backgroundColor: '#fef2f2',
        }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#dc2626' }}>❌ 오류</h3>
          <p style={{ margin: 0, color: '#dc2626', fontSize: 14 }}>
            {error}
          </p>
        </div>
      )}

      {/* 안내 */}
      <div style={{
        padding: 20,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        backgroundColor: '#f9fafb',
      }}>
        <h3 style={{ margin: '0 0 12px 0' }}>📋 체크리스트</h3>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#666' }}>
          <li>BotFather에서 봇 생성</li>
          <li>.env.local에 환경 변수 추가</li>
          <li>Vercel 환경 변수 설정 (3개 모두!)</li>
          <li>Vercel 재배포</li>
          <li>👆 위 버튼으로 Webhook 설정</li>
          <li>사용자 계정에서 텔레그램 연동 테스트</li>
        </ol>

        <div style={{ marginTop: 16, padding: 12, backgroundColor: '#fff3cd', borderRadius: 4 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#856404' }}>
            💡 <strong>환경 변수 필수 3개:</strong><br/>
            - TELEGRAM_BOT_TOKEN<br/>
            - TELEGRAM_BOT_USERNAME<br/>
            - TELEGRAM_SECRET_TOKEN
          </p>
        </div>
      </div>
    </div>
  )
}

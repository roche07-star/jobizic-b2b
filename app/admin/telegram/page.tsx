'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
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
      // Supabase 세션에서 access token 가져오기
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('세션이 만료되었습니다. 다시 로그인해주세요.')
        return
      }

      const res = await fetch('/api/telegram/setup', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
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
      // Supabase 세션에서 access token 가져오기
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('세션이 만료되었습니다. 다시 로그인해주세요.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '설정에 실패했습니다.')
        if (data.details) {
          setError(data.error + '\n' + data.details)
        }
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
    return (
      <main className="page">
        <div className="empty"><div className="spinner" /></div>
      </main>
    )
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-title">🤖 텔레그램 봇 관리</div>
          <div className="page-sub">Webhook 설정 및 상태 확인</div>
        </div>
      </div>

      {/* 현재 상태 */}
      {status && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">현재 상태</div>
          <div style={{
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
            backgroundColor: status.configured ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${status.configured ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{status.configured ? '✅' : '⚠️'}</span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                {status.configured ? '설정 완료' : '설정 필요'}
              </h3>
            </div>
            {status.botInfo && (
              <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 12 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div>
                    <span style={{ color: 'var(--muted2)' }}>봇 이름:</span>{' '}
                    <strong>{status.botInfo.first_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted2)' }}>Username:</span>{' '}
                    <strong>@{status.botInfo.username}</strong>
                  </div>
                  {status.webhookUrl && (
                    <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4 }}>Webhook URL</div>
                      <code style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        background: 'var(--bg3)',
                        borderRadius: 4,
                        display: 'inline-block',
                        wordBreak: 'break-all',
                      }}>
                        {status.webhookUrl}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!status.configured && (
              <p style={{ margin: '12px 0 0 0', fontSize: 14, color: 'var(--danger)' }}>
                {status.message || '봇 설정이 필요합니다.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Webhook 설정 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Webhook 설정</div>
        <p style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 16 }}>
          텔레그램 봇과 서버를 연결합니다. 이 작업은 한 번만 실행하면 됩니다.
        </p>

        <button
          onClick={setupWebhook}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? '설정 중...' : '🚀 Webhook 설정하기'}
        </button>
      </div>

      {/* 결과 */}
      {result && (
        <div className="card" style={{
          marginBottom: 20,
          border: '1px solid rgba(34, 197, 94, 0.3)',
          background: 'rgba(34, 197, 94, 0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>
              설정 완료!
            </h3>
          </div>

          {result.botInfo && (
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: 'var(--muted2)' }}>봇 정보</h4>
              <pre style={{
                padding: 12,
                backgroundColor: 'var(--bg3)',
                borderRadius: 4,
                fontSize: 12,
                overflow: 'auto',
                margin: 0,
              }}>
                {JSON.stringify(result.botInfo, null, 2)}
              </pre>
            </div>
          )}

          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{result.webhook ? '✅' : '❌'}</span>
              <span>Webhook: {result.webhook ? '설정 완료' : '실패'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{result.commands ? '✅' : '❌'}</span>
              <span>명령어: {result.commands ? '등록 완료' : '실패'}</span>
            </div>
          </div>

          {result.warning && (
            <div style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 8,
              fontSize: 13,
            }}>
              ⚠️ {result.warning}
            </div>
          )}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="card" style={{
          marginBottom: 20,
          border: '1px solid rgba(239, 68, 68, 0.3)',
          background: 'rgba(239, 68, 68, 0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>❌</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>오류</h3>
          </div>
          <p style={{ margin: 0, color: 'var(--danger)', fontSize: 14, whiteSpace: 'pre-line' }}>
            {error}
          </p>
        </div>
      )}

      {/* 안내 */}
      <div className="card">
        <div className="card-title">📋 설정 체크리스트</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--muted)', lineHeight: 1.8 }}>
          <li>BotFather에서 봇 생성</li>
          <li>.env.local에 환경 변수 추가</li>
          <li>Vercel 환경 변수 설정 (3개 모두!)</li>
          <li>Vercel 재배포</li>
          <li>👆 위 버튼으로 Webhook 설정</li>
          <li>사용자 계정에서 텔레그램 연동 테스트</li>
        </ol>

        <div style={{
          marginTop: 16,
          padding: 12,
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 8,
        }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            💡 <strong>환경 변수 필수 3개:</strong>
          </p>
          <ul style={{ margin: '8px 0 0 20px', fontSize: 13, lineHeight: 1.6 }}>
            <li>TELEGRAM_BOT_TOKEN</li>
            <li>TELEGRAM_BOT_USERNAME</li>
            <li>TELEGRAM_SECRET_TOKEN</li>
          </ul>
        </div>
      </div>
    </main>
  )
}

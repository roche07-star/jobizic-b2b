'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function TelegramAdminPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
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
    setCheckingStatus(true)
    try {
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

      if (res.ok) {
        setStatus(data)
        setError('')
      } else {
        setStatus({ configured: false, message: data.error })
      }
    } catch (err) {
      console.error('Status check error:', err)
      setStatus({ configured: false, message: '상태 확인 실패' })
    } finally {
      setCheckingStatus(false)
    }
  }

  async function setupWebhook() {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('세션이 만료되었습니다. 페이지를 새로고침해주세요.')
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
        let errorMsg = data.error || '설정에 실패했습니다.'
        if (data.details) {
          errorMsg += `\n\n상세: ${data.details}`
        }
        setError(errorMsg)
        return
      }

      setResult(data)
      setError('')

      // 성공 후 상태 자동 갱신
      setTimeout(() => checkStatus(), 1000)
    } catch (err: any) {
      setError(`오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`)
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
        <button
          onClick={checkStatus}
          disabled={checkingStatus}
          className="btn btn-ghost btn-sm"
        >
          {checkingStatus ? '확인 중...' : '🔄 상태 새로고침'}
        </button>
      </div>

      {/* 현재 상태 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">현재 상태</div>
        {checkingStatus ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: 12, color: 'var(--muted2)' }}>상태 확인 중...</p>
          </div>
        ) : status ? (
          <div style={{
            padding: 16,
            borderRadius: 8,
            backgroundColor: status.configured ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${status.configured ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{status.configured ? '✅' : '⚙️'}</span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                {status.configured ? '✨ 설정 완료 - 사용 준비됨!' : '설정이 필요합니다'}
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
                        fontSize: 11,
                        padding: '6px 10px',
                        background: 'var(--bg3)',
                        borderRadius: 4,
                        display: 'block',
                        wordBreak: 'break-all',
                      }}>
                        {status.webhookUrl}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!status.configured && status.message && (
              <p style={{ margin: '12px 0 0 0', fontSize: 14, color: 'var(--muted)' }}>
                {status.message}
              </p>
            )}
          </div>
        ) : (
          <p style={{ padding: 16, color: 'var(--muted2)' }}>상태를 확인할 수 없습니다.</p>
        )}
      </div>

      {/* Webhook 설정 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          {status?.configured ? '🔄 Webhook 재설정' : '⚙️ Webhook 설정'}
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 16 }}>
          {status?.configured
            ? '설정을 변경하거나 문제가 있을 때 다시 설정할 수 있습니다.'
            : '텔레그램 봇과 서버를 연결합니다. 버튼을 클릭하면 자동으로 설정됩니다.'}
        </p>

        <button
          onClick={setupWebhook}
          disabled={loading}
          className={`btn ${status?.configured ? 'btn-ghost' : 'btn-primary'}`}
          style={{ minWidth: 200 }}
        >
          {loading ? (
            <>
              <span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }} />
              설정 중...
            </>
          ) : status?.configured ? (
            '🔄 다시 설정하기'
          ) : (
            '🚀 지금 설정하기'
          )}
        </button>

        {!status?.configured && (
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--muted2)' }}>
            💡 환경 변수(TELEGRAM_BOT_TOKEN 등)가 설정되어 있어야 합니다
          </p>
        )}
      </div>

      {/* 성공 결과 */}
      {result && (
        <div className="card" style={{
          marginBottom: 20,
          border: '2px solid rgba(34, 197, 94, 0.4)',
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.1))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>🎉</span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--success)' }}>
              설정이 완료되었습니다!
            </h3>
          </div>

          <div style={{ display: 'grid', gap: 12, fontSize: 14, marginBottom: 16 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              background: 'var(--bg)',
              borderRadius: 6,
            }}>
              <span style={{ fontSize: 18 }}>{result.webhook ? '✅' : '❌'}</span>
              <span style={{ fontWeight: 500 }}>Webhook:</span>
              <span style={{ color: result.webhook ? 'var(--success)' : 'var(--danger)' }}>
                {result.webhook ? '설정 완료' : '설정 실패'}
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              background: 'var(--bg)',
              borderRadius: 6,
            }}>
              <span style={{ fontSize: 18 }}>{result.commands ? '✅' : '❌'}</span>
              <span style={{ fontWeight: 500 }}>명령어:</span>
              <span style={{ color: result.commands ? 'var(--success)' : 'var(--danger)' }}>
                {result.commands ? '등록 완료' : '등록 실패'}
              </span>
            </div>
          </div>

          {result.botInfo && (
            <div style={{
              padding: 12,
              background: 'var(--bg)',
              borderRadius: 8,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--muted2)' }}>
                봇 정보
              </div>
              <div style={{ fontSize: 14 }}>
                <strong>{result.botInfo.first_name}</strong> (@{result.botInfo.username})
              </div>
            </div>
          )}

          {result.warning && (
            <div style={{
              padding: 12,
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 8,
              fontSize: 13,
            }}>
              ⚠️ {result.warning}
            </div>
          )}

          <div style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
          }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
              👉 이제 사용자들이 텔레그램 연동을 할 수 있습니다!
            </p>
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="card" style={{
          marginBottom: 20,
          border: '2px solid rgba(239, 68, 68, 0.4)',
          background: 'rgba(239, 68, 68, 0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>
              오류가 발생했습니다
            </h3>
          </div>
          <p style={{ margin: 0, color: 'var(--text)', fontSize: 14, whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            {error}
          </p>
          <div style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid rgba(239, 68, 68, 0.2)',
          }}>
            <p style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600 }}>해결 방법:</p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
              <li>Vercel 환경 변수가 올바르게 설정되었는지 확인</li>
              <li>페이지를 새로고침하고 다시 시도</li>
              <li>문제가 계속되면 관리자에게 문의</li>
            </ul>
          </div>
        </div>
      )}

      {/* 안내 */}
      <div className="card">
        <div className="card-title">📋 환경 변수 체크리스트</div>
        <p style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 16 }}>
          Vercel에 다음 환경 변수가 설정되어 있어야 합니다:
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_SECRET_TOKEN'].map((key) => (
            <div key={key} style={{
              padding: 12,
              background: 'var(--bg3)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <code style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
                {key}
              </code>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 16,
          padding: 12,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 8,
        }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            💡 <strong>참고:</strong> 환경 변수 변경 후에는 반드시 Vercel을 재배포해야 적용됩니다.
          </p>
        </div>
      </div>
    </main>
  )
}

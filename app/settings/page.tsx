'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import TelegramLink from '@/components/TelegramLink'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ToastContainer'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

interface Member {
  id: string
  full_name: string | null
  email: string
  role: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [showMembers, setShowMembers] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)

  // 비밀번호 변경
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // 브라우저 알림 설정
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState(true)
  const [savingNotifSettings, setSavingNotifSettings] = useState(false)

  const { toasts, success, error, removeToast } = useToast()

  useEffect(() => {
    getProfile().then(p => {
      if (!p) {
        router.push('/login')
        return
      }
      setProfile(p)
      // 브라우저 알림 설정 로드
      setBrowserNotifEnabled(p.browser_notifications_enabled !== false)
    })
  }, [])

  async function loadMembers() {
    if (!profile?.organization_id) return

    setLoadingMembers(true)
    try {
      const res = await fetch(`/api/organizations/${profile.organization_id}/members`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data)
      }
    } catch (error) {
      console.error('[loadMembers] Error:', error)
    } finally {
      setLoadingMembers(false)
    }
  }

  function toggleMembers() {
    if (!showMembers && members.length === 0) {
      loadMembers()
    }
    setShowMembers(!showMembers)
  }

  function getRoleLabel(role: string) {
    const roleLabels: Record<string, string> = {
      'admin': 'Super Admin',
      'owner': 'Owner',
      'headhunter': 'PM',
      'searcher': 'Searcher',
      'client': '고객사',
      'client_owner': '고객사 Owner',
      'client_pm': '고객사 PM',
      'client_searcher': '고객사 Searcher',
    }
    return roleLabels[role] || role
  }

  async function toggleBrowserNotifications(enabled: boolean) {
    setSavingNotifSettings(true)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browser_notifications_enabled: enabled })
      })

      if (!res.ok) {
        throw new Error('Failed to update settings')
      }

      setBrowserNotifEnabled(enabled)

      // 브라우저 알림 권한 요청 (enable인 경우)
      if (enabled && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission()
      }

      success(enabled ? '✅ 브라우저 알림이 활성화되었습니다!' : '✅ 브라우저 알림이 비활성화되었습니다!')
    } catch (e) {
      error('설정 변경 중 오류가 발생했습니다.')
      // 실패 시 되돌리기
      setBrowserNotifEnabled(!enabled)
    } finally {
      setSavingNotifSettings(false)
    }
  }

  async function handleChangePassword() {
    // 유효성 검사
    if (!newPassword.trim()) {
      error(profile.password_set === false ? '비밀번호를 입력해주세요.' : '새 비밀번호를 입력해주세요.')
      return
    }

    if (newPassword.length < 8) {
      error('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    if (newPassword !== confirmPassword) {
      error('비밀번호가 일치하지 않습니다.')
      return
    }

    setChangingPassword(true)
    try {
      const supabase = getSupabaseBrowser()

      // 세션 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        error('로그인이 필요합니다.')
        return
      }

      // 직접 비밀번호 업데이트 (현재 비밀번호 검증 없이)
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        console.error('[change-password] Update error:', updateError)
        error('비밀번호 변경 중 오류가 발생했습니다.')
        return
      }

      // password_set 플래그 업데이트 (처음 설정한 경우)
      if (profile.password_set === false) {
        await fetch('/api/auth/set-password-flag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        })
      }

      const successMsg = profile.password_set === false
        ? '✅ 비밀번호가 성공적으로 설정되었습니다!\n\n새 비밀번호로 다시 로그인해주세요.'
        : '✅ 비밀번호가 성공적으로 변경되었습니다!\n\n새 비밀번호로 다시 로그인해주세요.'

      success(successMsg)
      alert(successMsg)

      // 로그아웃 처리
      await supabase.auth.signOut()

      // 로그인 페이지로 이동
      router.push('/')
    } catch (e) {
      error('비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setChangingPassword(false)
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
          <div className="page-title">⚙️ 설정</div>
          <div className="page-sub">계정 및 알림 설정</div>
        </div>
      </div>

      {/* 프로필 정보 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">👤 프로필 정보</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4 }}>이름</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{profile.full_name || '이름 없음'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4 }}>이메일</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{profile.email}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4 }}>역할</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{profile.role}</div>
          </div>
          {profile.organization && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4 }}>조직</div>
              <div
                onClick={toggleMembers}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  margin: '-4px -8px',
                  borderRadius: 6,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span>{profile.organization.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {showMembers ? '▼' : '▶'}
                </span>
              </div>

              {/* 구성원 목록 */}
              {showMembers && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 16,
                    background: 'var(--bg3)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
                    👥 구성원 ({members.length}명)
                  </div>

                  {loadingMembers ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                      <div className="spinner" style={{ margin: '0 auto' }} />
                    </div>
                  ) : members.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)', fontSize: 13 }}>
                      구성원 정보를 불러올 수 없습니다.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {members.map((member) => (
                        <div
                          key={member.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: 'var(--bg)',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                              {member.full_name || '이름 없음'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                              {member.email}
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              background:
                                member.role === 'owner'
                                  ? 'rgba(232, 255, 71, 0.15)'
                                  : member.role === 'headhunter'
                                  ? 'rgba(74, 158, 255, 0.15)'
                                  : 'rgba(136, 136, 128, 0.15)',
                              color:
                                member.role === 'owner'
                                  ? 'var(--accent)'
                                  : member.role === 'headhunter'
                                  ? '#4a9eff'
                                  : 'var(--muted)',
                              borderRadius: 4,
                              fontWeight: 600,
                            }}
                          >
                            {getRoleLabel(member.role)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 비밀번호 설정/변경 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          {profile.password_set === false ? '🔐 비밀번호 설정' : '🔐 비밀번호 변경'}
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 20 }}>
          {profile.password_set === false
            ? '처음 로그인하셨네요! 안전한 비밀번호를 설정해주세요.'
            : '계정 보안을 위해 주기적으로 비밀번호를 변경하세요.'}
        </p>

        <div style={{ display: 'grid', gap: 16, maxWidth: 400 }}>
          <div>
            <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
              {profile.password_set === false ? '비밀번호' : '새 비밀번호'}
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="비밀번호 (8자 이상)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={changingPassword}
            />
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
              {profile.password_set === false ? '비밀번호 확인' : '새 비밀번호 확인'}
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="비밀번호 다시 입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={changingPassword}
            />
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword || !confirmPassword}
              style={{ width: 'fit-content' }}
            >
              {changingPassword
                ? profile.password_set === false ? '설정 중...' : '변경 중...'
                : profile.password_set === false ? '🔐 비밀번호 설정' : '🔐 비밀번호 변경'}
            </button>
          </div>
        </div>
      </div>

      {/* 브라우저 알림 설정 */}
      {profile.role === 'admin' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">🔔 브라우저 알림</div>
          <p style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 16 }}>
            새 구직 요청 시 브라우저 알림을 받습니다.
          </p>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            width: 'fit-content',
            padding: '8px 12px',
            borderRadius: 8,
            transition: 'background 0.2s',
            background: browserNotifEnabled ? 'rgba(232, 255, 71, 0.1)' : 'transparent'
          }}>
            <input
              type="checkbox"
              checked={browserNotifEnabled}
              onChange={(e) => toggleBrowserNotifications(e.target.checked)}
              disabled={savingNotifSettings}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span style={{
              fontSize: 14,
              fontWeight: 500,
              color: browserNotifEnabled ? 'var(--text)' : 'var(--muted)'
            }}>
              {savingNotifSettings ? '저장 중...' : browserNotifEnabled ? '브라우저 알림 켜짐 ✅' : '브라우저 알림 꺼짐'}
            </span>
          </label>
          {browserNotifEnabled && 'Notification' in window && Notification.permission !== 'granted' && (
            <div style={{
              marginTop: 12,
              padding: 12,
              background: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              borderRadius: 8,
              fontSize: 13,
              color: '#ffc107'
            }}>
              ⚠️ 브라우저 알림 권한이 필요합니다. 설정에서 허용해주세요.
            </div>
          )}
        </div>
      )}

      {/* 텔레그램 연동 */}
      <div className="card">
        <div className="card-title">📱 텔레그램 알림</div>
        <p style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 16 }}>
          텔레그램으로 실시간 알림을 받아보세요!
        </p>
        <TelegramLink />
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </main>
  )
}

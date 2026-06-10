'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import TelegramLink from '@/components/TelegramLink'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ToastContainer'
import { createClient } from '@supabase/supabase-js'

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
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const { toasts, success, error, removeToast } = useToast()

  useEffect(() => {
    getProfile().then(p => {
      if (!p) {
        router.push('/login')
        return
      }
      setProfile(p)
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

  async function handleChangePassword() {
    // 유효성 검사
    if (!currentPassword.trim()) {
      error('현재 비밀번호를 입력해주세요.')
      return
    }

    if (!newPassword.trim()) {
      error('새 비밀번호를 입력해주세요.')
      return
    }

    if (newPassword.length < 8) {
      error('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }

    if (newPassword !== confirmPassword) {
      error('새 비밀번호가 일치하지 않습니다.')
      return
    }

    if (currentPassword === newPassword) {
      error('새 비밀번호는 현재 비밀번호와 달라야 합니다.')
      return
    }

    setChangingPassword(true)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // 세션 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        error('로그인이 필요합니다.')
        return
      }

      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const data = await res.json()

      if (res.ok) {
        success('✅ 비밀번호가 성공적으로 변경되었습니다!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        error(data.error || '비밀번호 변경에 실패했습니다.')
      }
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

      {/* 비밀번호 변경 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">🔐 비밀번호 변경</div>
        <p style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 20 }}>
          계정 보안을 위해 주기적으로 비밀번호를 변경하세요.
        </p>

        <div style={{ display: 'grid', gap: 16, maxWidth: 400 }}>
          <div>
            <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
              현재 비밀번호
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="현재 비밀번호 입력"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={changingPassword}
            />
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
              새 비밀번호
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="새 비밀번호 (8자 이상)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={changingPassword}
            />
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
              새 비밀번호 확인
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="새 비밀번호 다시 입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={changingPassword}
            />
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              style={{ width: 'fit-content' }}
            >
              {changingPassword ? '변경 중...' : '🔐 비밀번호 변경'}
            </button>
          </div>
        </div>
      </div>

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

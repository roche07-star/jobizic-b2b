'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import TelegramLink from '@/components/TelegramLink'

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

      {/* 텔레그램 연동 */}
      <div className="card">
        <div className="card-title">📱 텔레그램 알림</div>
        <p style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 16 }}>
          텔레그램으로 실시간 알림을 받아보세요!
        </p>
        <TelegramLink />
      </div>
    </main>
  )
}

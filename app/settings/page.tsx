'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import TelegramLink from '@/components/TelegramLink'

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    getProfile().then(p => {
      if (!p) {
        router.push('/login')
        return
      }
      setProfile(p)
    })
  }, [])

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
              <div style={{ fontSize: 14, fontWeight: 500 }}>{profile.organization.name}</div>
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

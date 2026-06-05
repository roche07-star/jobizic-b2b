'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getProfile, signOut, type Profile } from '@/lib/auth'

const links = [
  { href: '/', label: '대시보드' },
  { href: '/jd', label: 'JD 관리' },
  { href: '/candidates', label: '후보자' },
  { href: '/pipeline', label: '채용 프로세스' },
]

const adminLinks = [
  { href: '/admin', label: '관리자' },
]

export default function Nav() {
  const path = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    getProfile().then(p => {
      console.log('[Nav] Profile loaded:', p)
      console.log('[Nav] Profile role:', p?.role)
      setProfile(p)

      // 비밀번호 변경이 필요한 경우 (임시 비밀번호로 로그인)
      if (p?.password_set === false && path !== '/auth/set-password') {
        router.push('/auth/set-password')
      }
    })
  }, [path, router])

  async function handleSignOut() {
    setProfile(null) // 즉시 UI 클리어
    await signOut()
    window.location.href = '/login' // 강제 새로고침
  }

  // 로그인 페이지에서는 Nav 숨기기
  if (path === '/login') {
    return null
  }

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        JOBIZIC <span>biz</span>
      </Link>
      <div className="nav-links">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link${path === l.href || (l.href !== '/' && path.startsWith(l.href)) ? ' active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
        {(() => {
          const shouldShow = profile?.role === 'admin' || profile?.role === 'owner'
          console.log('[Nav] Should show admin links?', shouldShow, 'profile.role:', profile?.role)
          return shouldShow && adminLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link${path === l.href || (l.href !== '/' && path.startsWith(l.href)) ? ' active' : ''}`}
            >
              {l.label}
            </Link>
          ))
        })()}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {profile && (
          <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
            {profile.organization && (
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                {profile.organization.name}
              </span>
            )}
            {profile.organization && <span style={{ margin: '0 6px' }}>·</span>}
            {profile.full_name || profile.email}
            {profile.role === 'admin' && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>Super Admin</span>}
            {profile.role === 'owner' && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>오너</span>}
            {profile.role === 'client' && <span style={{ color: 'var(--muted2)', marginLeft: 6 }}>고객사</span>}
          </div>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleSignOut}
          style={{ fontSize: 12 }}
        >
          로그아웃
        </button>
      </div>
    </nav>
  )
}

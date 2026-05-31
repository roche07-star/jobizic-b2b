'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getProfile, signOut, type Profile } from '@/lib/auth'

const links = [
  { href: '/', label: '대시보드' },
  { href: '/jd', label: 'JD 관리' },
  { href: '/candidates', label: '후보자' },
  { href: '/pipeline', label: '파이프라인' },
]

export default function Nav() {
  const path = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    getProfile().then(setProfile)
  }, [])

  async function handleSignOut() {
    await signOut()
    router.push('/login')
    router.refresh()
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
      </div>
      {profile && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
            {profile.full_name || profile.email}
            {profile.role === 'admin' && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>관리자</span>}
            {profile.role === 'client' && <span style={{ color: 'var(--muted2)', marginLeft: 6 }}>고객사</span>}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleSignOut}
            style={{ fontSize: 12 }}
          >
            로그아웃
          </button>
        </div>
      )}
    </nav>
  )
}

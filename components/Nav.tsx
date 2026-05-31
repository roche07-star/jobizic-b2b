'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: '대시보드' },
  { href: '/jd', label: 'JD 관리' },
  { href: '/candidates', label: '후보자' },
  { href: '/pipeline', label: '파이프라인' },
]

export default function Nav() {
  const path = usePathname()
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
    </nav>
  )
}

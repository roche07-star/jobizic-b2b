'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getProfile, signOut, type Profile } from '@/lib/auth'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

interface Notification {
  id: string
  type: string
  title: string
  message: string | null
  action_url: string | null
  is_read: boolean
  created_at: string
  sender_name: string | null
}

const links = [
  { href: '/', label: '대시보드' },
  { href: '/jd', label: 'JD 관리' },
  { href: '/candidates', label: '후보자' },
  { href: '/pipeline', label: '채용 프로세스' },
  { href: '/boards', label: '📢 게시판' },
  { href: '/settlements', label: '💰 정산' },
  { href: '/settings', label: '⚙️ 설정' },
]

const adminLinks = [
  { href: '/admin', label: '관리자' },
]

export default function Nav() {
  const path = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getProfile().then(p => {
      console.log('[Nav] Profile loaded:', p)
      console.log('[Nav] Profile role:', p?.role)
      setProfile(p)

      // 비밀번호 변경이 필요한 경우 (임시 비밀번호로 로그인)
      if (p?.password_set === false && path !== '/auth/set-password') {
        router.push('/auth/set-password')
      }

      // 알림 로드
      if (p) {
        loadNotifications()
      }
    })
  }, [path, router])

  // 알림 로드
  async function loadNotifications() {
    try {
      const supabase = getSupabaseBrowser()

      // 알림 목록 조회 (RLS 적용)
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      // 읽지 않은 알림 개수
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)

      setNotifications(notifications || [])
      setUnreadCount(count || 0)
    } catch (e) {
      console.error('[loadNotifications] Error:', e)
    }
  }

  // 알림 읽음 처리
  async function markAsRead(id: string) {
    try {
      const supabase = getSupabaseBrowser()

      await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', id)

      await loadNotifications()
    } catch (e) {
      console.error('[markAsRead] Error:', e)
    }
  }

  // 전체 읽음 처리
  async function markAllAsRead() {
    try {
      const supabase = getSupabaseBrowser()

      const { data: user } = await supabase.auth.getUser()
      if (!user?.user?.id) return

      await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', user.user.id)
        .eq('is_read', false)

      await loadNotifications()
    } catch (e) {
      console.error('[markAllAsRead] Error:', e)
    }
  }

  // 알림 삭제
  async function deleteNotification(id: string) {
    try {
      const supabase = getSupabaseBrowser()

      await supabase
        .from('notifications')
        .delete()
        .eq('id', id)

      // UI에서 즉시 제거
      setNotifications(prev => prev.filter(n => n.id !== id))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (e) {
      console.error('[deleteNotification] Error:', e)
    }
  }

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    setProfile(null) // 즉시 UI 클리어
    await signOut()
    window.location.href = '/login' // 강제 새로고침
  }

  // 로그인 페이지에서는 Nav 숨기기
  if (path === '/login') {
    return null
  }

  const allLinks = [
    ...links,
    ...((profile?.role === 'admin' || profile?.role === 'owner') ? adminLinks : [])
  ]

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        JOBIZIC <span>biz</span>
      </Link>

      {/* 데스크톱 메뉴 */}
      <div className="nav-links nav-desktop">
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

      {/* 모바일 햄버거 메뉴 */}
      <div className="nav-mobile" ref={mobileMenuRef}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          style={{ fontSize: 20, padding: '4px 8px' }}
        >
          ☰
        </button>

        {showMobileMenu && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '200px',
            background: 'rgba(20, 20, 20, 0.98)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 9999,
            overflow: 'hidden',
          }}>
            {allLinks.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`mobile-nav-link${path === l.href || (l.href !== '/' && path.startsWith(l.href)) ? ' active' : ''}`}
                onClick={() => setShowMobileMenu(false)}
                style={{
                  display: 'block',
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: path === l.href || (l.href !== '/' && path.startsWith(l.href)) ? 600 : 400,
                  background: path === l.href || (l.href !== '/' && path.startsWith(l.href)) ? 'rgba(232, 255, 71, 0.1)' : 'transparent',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {profile && (
          <div className="nav-profile" style={{ fontSize: 12, color: 'var(--muted2)' }}>
            {profile.organization && (
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                {profile.organization.name}
              </span>
            )}
            {profile.organization && <span style={{ margin: '0 6px' }}>·</span>}
            <span className="nav-profile-name">{profile.full_name || profile.email}</span>
            {profile.role === 'admin' && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>Super Admin</span>}
            {profile.role === 'owner' && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>오너</span>}
            {profile.role === 'client' && <span style={{ color: 'var(--muted2)', marginLeft: 6 }}>고객사</span>}
          </div>
        )}

        {/* 알림 */}
        {profile && (
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ position: 'relative', fontSize: 16, padding: '4px 8px' }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  background: 'var(--danger)',
                  color: 'white',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  fontSize: 10,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* 알림 드롭다운 */}
            {showNotifications && (
              <div className="notification-dropdown" style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 'min(300px, 85vw)',
                maxWidth: '85vw',
                maxHeight: 350,
                background: 'rgba(20, 20, 20, 0.98)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 9999,
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>알림</div>
                  {unreadCount > 0 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={markAllAsRead}
                      style={{ fontSize: 10, padding: '2px 6px' }}
                    >
                      전체 읽음
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{
                      padding: 30,
                      textAlign: 'center',
                      color: 'var(--muted2)',
                      fontSize: 12,
                    }}>
                      알림이 없습니다
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        className="notification-item"
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--border)',
                          background: notif.is_read ? 'transparent' : 'rgba(255,255,255,0.03)',
                          cursor: notif.action_url ? 'pointer' : 'default',
                          position: 'relative',
                        }}
                        onClick={() => {
                          if (!notif.is_read) markAsRead(notif.id)
                          if (notif.action_url) {
                            router.push(notif.action_url)
                            setShowNotifications(false)
                          }
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 3,
                        }}>
                          <div style={{ fontWeight: 600, fontSize: 12, flex: 1, paddingRight: '20px' }}>
                            {notif.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {!notif.is_read && (
                              <div style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: 'var(--accent)',
                              }} />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNotification(notif.id)
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--muted)',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                fontSize: '14px',
                                lineHeight: 1,
                                transition: 'color 0.2s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
                              title="알림 삭제"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        {notif.message && (
                          <div style={{
                            fontSize: 11,
                            color: 'var(--muted)',
                            marginBottom: 3,
                          }}>
                            {notif.message}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--muted2)' }}>
                          {new Date(notif.created_at).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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

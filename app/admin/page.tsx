'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import JobRequestsSection from './JobRequestsSection'

interface Organization {
  id: string
  name: string
  type: string
  contact_email: string
  contact_phone?: string
  status: string
  created_at: string
  members?: Array<{
    id: string
    full_name: string | null
    email: string
  }>
}

interface Permissions {
  jd: { read: boolean; write: boolean }
  candidate: { read: boolean; write: boolean }
  pipeline: { read: boolean; write: boolean }
  recommendation: { execute: boolean }
  board: { read: boolean; write: boolean }
}

interface User {
  id: string
  email: string
  full_name: string | null
  role: string
  organization_id: string | null
  is_active: boolean
  permissions?: Permissions | null
  organizations: { id: string; name: string; type: string } | null
  created_at: string
  telegram_chat_id: string | null
  telegram_username: string | null
  telegram_verified_at: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // 조직 생성 폼
  const [showOrgForm, setShowOrgForm] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState('headhunter')
  const [orgEmail, setOrgEmail] = useState('')
  const [orgPhone, setOrgPhone] = useState('')
  const [orgAdminEmail, setOrgAdminEmail] = useState('') // 관리자 이메일
  const [orgAdminName, setOrgAdminName] = useState('') // 관리자 이름
  const [inviteMethod, setInviteMethod] = useState<'fixed' | 'email'>('fixed') // 초대 방식
  const [creatingOrg, setCreatingOrg] = useState(false)

  // 조직 수정 폼
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [editOrgName, setEditOrgName] = useState('')
  const [editOrgType, setEditOrgType] = useState('')
  const [editOrgEmail, setEditOrgEmail] = useState('')
  const [editOrgPhone, setEditOrgPhone] = useState('')
  const [editOrgStatus, setEditOrgStatus] = useState('')
  const [updatingOrg, setUpdatingOrg] = useState(false)

  // 사용자 생성 폼
  const [showUserForm, setShowUserForm] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userFullName, setUserFullName] = useState('')
  const [userRole, setUserRole] = useState('headhunter')
  const [userOrgId, setUserOrgId] = useState('')
  const [userInviteMethod, setUserInviteMethod] = useState<'fixed' | 'email'>('fixed') // 초대 방식
  const [creatingUser, setCreatingUser] = useState(false)

  // 사용자 수정 폼
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editOrgId, setEditOrgId] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editPassword, setEditPassword] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [editPermissions, setEditPermissions] = useState<Permissions>({
    jd: { read: true, write: false },
    candidate: { read: true, write: false },
    pipeline: { read: true, write: false },
    recommendation: { execute: false },
    board: { read: true, write: false }
  })
  const [updatingUser, setUpdatingUser] = useState(false)

  // 업무 이관
  const [showTransferUI, setShowTransferUI] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [transferring, setTransferring] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProfile().then(p => {
      // JOBIZIC Manager는 조회 전용이므로 admin 페이지 접근 불가
      const isJobizicManager = p?.role === 'manager' && p?.organization?.type === 'platform'

      if (!p || (p.role !== 'admin' && p.role !== 'owner' && p.role !== 'manager') || isJobizicManager) {
        router.push('/')
        return
      }
      setProfile(p)
      loadData()
    })
  }, [])

  async function loadData() {
    try {
      const p = await getProfile()
      const params = new URLSearchParams()
      if (p?.role) params.set('role', p.role)
      if (p?.organization_id) params.set('organization_id', p.organization_id)

      const [orgsRes, usersRes] = await Promise.all([
        fetch(`/api/admin/organizations?${params}`),
        fetch(`/api/admin/users?${params}`),
      ])
      const orgsData = await orgsRes.json()
      const usersData = await usersRes.json()
      setOrganizations(orgsData.organizations || [])
      setUsers(usersData.users || [])
    } catch (e) {
      setError('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  async function createOrganization() {
    if (!orgName) return
    setCreatingOrg(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          type: orgType,
          contact_email: orgEmail,
          contact_phone: orgPhone,
          admin_email: orgAdminEmail || null,
          admin_name: orgAdminName || null,
          invite_method: inviteMethod, // 'fixed' | 'email'
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      console.log('Organization created:', data)

      setOrganizations([data.organization || data, ...organizations])
      setShowOrgForm(false)
      setOrgName('')
      setOrgEmail('')
      setOrgPhone('')
      setOrgAdminEmail('')
      setOrgAdminName('')
      setInviteMethod('fixed')

      if (orgAdminEmail) {
        if (data.invited_user) {
          const method = data.invited_user.method
          const password = data.invited_user.password

          if (method === 'fixed' && password) {
            // 고정 비밀번호 방식
            alert(`✅ 조직 & 사용자 생성 완료!\n\n📧 로그인 정보:\n이메일: ${orgAdminEmail}\n🔑 비밀번호: ${password}\n\n※ 사용자에게 직접 전달해주세요.`)
          } else if (method === 'email') {
            // 초대 이메일 방식
            alert(`✅ 조직이 생성되고 ${orgAdminEmail}로 초대 이메일이 발송되었습니다!\n\n사용자가 이메일에서 링크를 클릭하여 비밀번호를 설정할 수 있습니다.`)
          } else {
            alert(`✅ 조직이 생성되었습니다.\n\n사용자 정보를 확인할 수 없습니다.`)
          }
        } else {
          const errorMsg = data.user_creation_error || '알 수 없는 오류'
          alert(`✅ 조직은 생성되었으나 사용자 생성에 실패했습니다.\n\n오류: ${errorMsg}\n\n수동으로 사용자를 추가해주세요.`)
        }
      } else {
        alert('✅ 조직이 생성되었습니다!')
      }

      await loadData() // 새로고침
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreatingOrg(false)
    }
  }

  function startEditOrg(org: Organization) {
    setEditingOrg(org)
    setEditOrgName(org.name)
    setEditOrgType(org.type)
    setEditOrgEmail(org.contact_email || '')
    setEditOrgPhone(org.contact_phone || '')
    setEditOrgStatus(org.status)
  }

  async function updateOrganization() {
    if (!editingOrg) return
    setUpdatingOrg(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/organizations/${editingOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editOrgName,
          type: editOrgType,
          contact_email: editOrgEmail,
          contact_phone: editOrgPhone,
          status: editOrgStatus,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await loadData() // 새로고침
      setEditingOrg(null)
      alert('✅ 조직 정보가 수정되었습니다!')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUpdatingOrg(false)
    }
  }

  async function toggleOrgStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('상태 변경 실패')

      setOrganizations(orgs => orgs.map(o => o.id === id ? { ...o, status: newStatus } : o))
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function deleteOrganization(id: string, name: string) {
    if (!confirm(`"${name}" 조직을 삭제하시겠습니까?\n\n조직에 사용자가 있으면 삭제할 수 없습니다.`)) return

    try {
      const res = await fetch(`/api/admin/organizations/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setOrganizations(orgs => orgs.filter(o => o.id !== id))
      alert('✅ 조직이 삭제되었습니다.')
    } catch (e: any) {
      alert('❌ ' + e.message)
    }
  }

  async function createUser() {
    if (!userEmail) return
    setCreatingUser(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          full_name: userFullName,
          role: userRole,
          organization_id: userOrgId || null,
          invite_method: userInviteMethod, // 'fixed' | 'email'
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await loadData() // 새로고침
      setShowUserForm(false)
      setUserEmail('')
      setUserFullName('')
      setUserOrgId('')
      setUserInviteMethod('fixed')

      // 방식에 따라 다른 메시지
      if (data.method === 'fixed' && data.password) {
        alert(`✅ 사용자 생성 완료!\n\n📧 로그인 정보:\n이메일: ${userEmail}\n🔑 비밀번호: ${data.password}\n\n※ 사용자에게 직접 전달해주세요.`)
      } else if (data.method === 'email') {
        alert(data.message || '✅ 초대 이메일이 발송되었습니다!')
      } else {
        alert(data.message || '✅ 사용자가 생성되었습니다!')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreatingUser(false)
    }
  }

  function startEditUser(user: User) {
    setEditingUser(user)
    setEditFullName(user.full_name || '')
    setEditRole(user.role)
    setEditOrgId(user.organization_id || '')
    setEditIsActive(user.is_active)
    setEditPassword('') // 비밀번호 필드 초기화

    // Permissions 로드 (Manager인 경우)
    if (user.permissions) {
      setEditPermissions(user.permissions)
    } else {
      setEditPermissions({
        jd: { read: true, write: false },
        candidate: { read: true, write: false },
        pipeline: { read: true, write: false },
        recommendation: { execute: false },
        board: { read: true, write: false }
      })
    }
  }

  async function updateUser() {
    if (!editingUser) return

    // 비활성화 시도 시 업무 이관 확인
    if (editingUser.is_active && !editIsActive) {
      setShowTransferUI(true)
      return
    }

    setUpdatingUser(true)
    setError(null)
    try {
      const body: any = {
        full_name: editFullName,
        role: editRole,
        organization_id: editOrgId || null,
        is_active: editIsActive,
      }

      // Manager인 경우 permissions 추가
      if (editRole === 'manager') {
        body.permissions = editPermissions
      }

      // 비밀번호가 입력되었으면 추가
      if (editPassword && editPassword.trim()) {
        body.password = editPassword
      }

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await loadData() // 새로고침
      setEditingUser(null)
      setShowTransferUI(false)
      setTransferTarget('')
      alert('✅ 사용자 정보가 수정되었습니다!')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUpdatingUser(false)
    }
  }

  async function transferWork() {
    if (!editingUser || !transferTarget) return

    setTransferring(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_email: transferTarget }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      alert(`✅ 업무 이관 완료!\n\nJD: ${data.counts.jds}개\n후보자: ${data.counts.candidates}개\n파이프라인: ${data.counts.pipelines}개`)

      // 이관 완료 후 사용자 비활성화
      await updateUser()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTransferring(false)
    }
  }

  async function resetPassword(email: string) {
    if (!confirm(`"${email}" 사용자에게 비밀번호 재설정 이메일을 발송하시겠습니까?`)) return

    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      alert(`✅ ${email}로 비밀번호 재설정 이메일이 발송되었습니다!`)
    } catch (e: any) {
      alert('❌ ' + e.message)
    }
  }

  async function deleteUser(id: string, email: string) {
    if (!confirm(`"${email}" 사용자를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return

    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setUsers(users => users.filter(u => u.id !== id))
      alert('✅ 사용자가 삭제되었습니다.')
    } catch (e: any) {
      alert('❌ ' + e.message)
    }
  }

  if (loading) {
    return (
      <main className="page">
        <div className="empty"><div className="spinner" /></div>
      </main>
    )
  }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
    return null
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{profile.role === 'admin' ? '관리자 대시보드' : '관리자 기능'}</div>
          <div className="page-sub">조직 & 사용자 관리</div>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid var(--danger)', borderRadius: 8, marginBottom: 20, color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* 시스템 설정 */}
      {(profile.role === 'admin' || profile.role === 'owner' || profile.role === 'manager') && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">시스템 설정</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost"
              onClick={() => router.push('/admin/telegram')}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              📱 텔레그램 봇 설정
            </button>
          </div>
        </div>
      )}

      {/* 구직자 관리 (Adam에서 전송) */}
      {profile.role === 'admin' && <JobRequestsSection />}

      {/* 조직 관리 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>조직 관리 ({organizations.length})</span>
          {profile?.role === 'admin' && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowOrgForm(!showOrgForm)}>
              + 조직 생성
            </button>
          )}
        </div>

        {showOrgForm && (
          <div style={{ padding: 16, background: 'var(--bg3)', borderRadius: 8, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">조직명</label>
              <input className="form-input" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="ABC 써치펌" />
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">타입</label>
                <select className="form-select" value={orgType} onChange={e => setOrgType(e.target.value)}>
                  <option value="headhunter">써치펌 (헤드헌터)</option>
                  <option value="enterprise">채용사 (기업)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">담당자 이메일</label>
                <input className="form-input" type="email" value={orgEmail} onChange={e => setOrgEmail(e.target.value)} placeholder="contact@abc.com" />
              </div>
            </div>

            <div style={{ marginTop: 16, marginBottom: 12, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)', marginBottom: 8 }}>
                👤 관리자 초대 (선택사항)
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">관리자 이메일</label>
                <input className="form-input" type="email" value={orgAdminEmail} onChange={e => setOrgAdminEmail(e.target.value)} placeholder="admin@abc.com" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">관리자 이름</label>
                <input className="form-input" value={orgAdminName} onChange={e => setOrgAdminName(e.target.value)} placeholder="홍길동" />
              </div>
            </div>

            {orgAdminEmail && (
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
                  🔑 계정 생성 방식
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: 8, borderRadius: 6, background: inviteMethod === 'fixed' ? 'var(--bg)' : 'transparent', border: inviteMethod === 'fixed' ? '1px solid var(--accent)' : '1px solid transparent' }}>
                    <input
                      type="radio"
                      name="inviteMethod"
                      value="fixed"
                      checked={inviteMethod === 'fixed'}
                      onChange={() => setInviteMethod('fixed')}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>⚡ 빠른 생성 (고정 비밀번호)</div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
                        비밀번호: <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>jobizic112</code><br />
                        즉시 로그인 가능 · 테스트/개발용 추천
                      </div>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: 8, borderRadius: 6, background: inviteMethod === 'email' ? 'var(--bg)' : 'transparent', border: inviteMethod === 'email' ? '1px solid var(--accent)' : '1px solid transparent' }}>
                    <input
                      type="radio"
                      name="inviteMethod"
                      value="email"
                      checked={inviteMethod === 'email'}
                      onChange={() => setInviteMethod('email')}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>📧 초대 이메일 발송</div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
                        사용자가 직접 비밀번호 설정<br />
                        이메일 검증 자동 · 프로덕션용 추천
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={createOrganization} disabled={creatingOrg || !orgName}>
                {creatingOrg ? '생성 중...' : '🏢 조직 생성' + (orgAdminEmail ? ' & 초대 발송' : '')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowOrgForm(false)}>취소</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 8 }}>
          {organizations.map(org => (
            <div key={org.id} style={{ padding: 12, background: 'var(--bg3)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{org.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
                  {org.type} · {org.contact_email || '이메일 없음'}
                </div>
                {org.members && org.members.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    👥 {org.members.map(m => m.full_name || m.email.split('@')[0]).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge badge-${org.status}`}>{org.status}</span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => startEditOrg(org)}
                  style={{ fontSize: 11 }}
                >
                  수정
                </button>
                <button
                  className={`btn btn-sm ${org.status === 'active' ? 'btn-ghost' : 'btn-success'}`}
                  onClick={() => toggleOrgStatus(org.id, org.status)}
                  style={{ fontSize: 11 }}
                >
                  {org.status === 'active' ? '비활성화' : '활성화'}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteOrganization(org.id, org.name)}
                  style={{ fontSize: 11 }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 사용자 관리 */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>사용자 관리 ({users.length})</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowUserForm(!showUserForm)}
          >
            + 사용자 생성
          </button>
        </div>

        {showUserForm && (
          <div style={{ padding: 16, background: 'var(--bg3)', borderRadius: 8, marginBottom: 16 }}>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">이메일</label>
                <input className="form-input" type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">이름</label>
                <input className="form-input" value={userFullName} onChange={e => setUserFullName(e.target.value)} placeholder="홍길동" />
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">역할</label>
                <select className="form-select" value={userRole} onChange={e => setUserRole(e.target.value)}>
                  <option value="admin">Super Admin</option>
                  <optgroup label="써치펌">
                    <option value="owner">Owner (관리자)</option>
                    <option value="headhunter">Headhunter</option>
                    <option value="operator">Operator (직원)</option>
                  </optgroup>
                  <optgroup label="채용사">
                    <option value="manager">Manager</option>
                  </optgroup>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">조직</label>
                <select className="form-select" value={userOrgId} onChange={e => setUserOrgId(e.target.value)}>
                  <option value="">조직 선택 (선택사항)</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {userEmail && (
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
                  🔑 계정 생성 방식
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: 8, borderRadius: 6, background: userInviteMethod === 'fixed' ? 'var(--bg)' : 'transparent', border: userInviteMethod === 'fixed' ? '1px solid var(--accent)' : '1px solid transparent' }}>
                    <input
                      type="radio"
                      name="userInviteMethod"
                      value="fixed"
                      checked={userInviteMethod === 'fixed'}
                      onChange={() => setUserInviteMethod('fixed')}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>⚡ 빠른 생성 (고정 비밀번호)</div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
                        비밀번호: <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>jobizic112</code><br />
                        즉시 로그인 가능 · 테스트/개발용 추천
                      </div>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: 8, borderRadius: 6, background: userInviteMethod === 'email' ? 'var(--bg)' : 'transparent', border: userInviteMethod === 'email' ? '1px solid var(--accent)' : '1px solid transparent' }}>
                    <input
                      type="radio"
                      name="userInviteMethod"
                      value="email"
                      checked={userInviteMethod === 'email'}
                      onChange={() => setUserInviteMethod('email')}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>📧 초대 이메일 발송</div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
                        사용자가 직접 비밀번호 설정<br />
                        이메일 검증 자동 · 프로덕션용 추천
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={createUser} disabled={creatingUser || !userEmail}>
                {creatingUser ? (userInviteMethod === 'fixed' ? '생성 중...' : '발송 중...') : (userInviteMethod === 'fixed' ? '🚀 사용자 생성' : '📧 초대 이메일 발송')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowUserForm(false)}>취소</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 8 }}>
          {users.map(user => (
            <div key={user.id} style={{ padding: 12, background: 'var(--bg3)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>{user.email}</div>
                  {user.telegram_chat_id && (
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 3,
                      background: 'rgba(41, 171, 226, 0.15)',
                      color: '#29abe2',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }} title={`텔레그램: ${user.telegram_username || '연동됨'}`}>
                      📱 Telegram
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
                  {user.full_name || '이름 없음'} · {user.role}
                  {user.organizations && ` · ${user.organizations.name}`}
                  {user.telegram_username && ` · @${user.telegram_username}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${user.is_active ? 'badge-활성' : 'badge-보류'}`}>
                  {user.is_active ? '활성' : '비활성'}
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => startEditUser(user)}
                  style={{ fontSize: 11 }}
                >
                  수정
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => resetPassword(user.email)}
                  style={{ fontSize: 11 }}
                >
                  🔒 초기화
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteUser(user.id, user.email)}
                  style={{ fontSize: 11 }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 조직 수정 모달 */}
      {editingOrg && (
        <div className="overlay" onClick={() => setEditingOrg(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">조직 정보 수정</div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 4 }}>{editingOrg.name}</div>
              </div>
              <button className="modal-close" onClick={() => setEditingOrg(null)}>✕</button>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">조직명</label>
              <input className="form-input" value={editOrgName} onChange={e => setEditOrgName(e.target.value)} placeholder="ABC 써치펌" />
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">타입</label>
                <select className="form-select" value={editOrgType} onChange={e => setEditOrgType(e.target.value)}>
                  <option value="headhunter">써치펌 (헤드헌터)</option>
                  <option value="enterprise">채용사 (기업)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">상태</label>
                <select className="form-select" value={editOrgStatus} onChange={e => setEditOrgStatus(e.target.value)}>
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">담당자 이메일</label>
                <input className="form-input" type="email" value={editOrgEmail} onChange={e => setEditOrgEmail(e.target.value)} placeholder="contact@abc.com" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">전화번호</label>
                <input className="form-input" value={editOrgPhone} onChange={e => setEditOrgPhone(e.target.value)} placeholder="02-1234-5678" />
              </div>
            </div>

            {error && (
              <div style={{ padding: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid var(--danger)', borderRadius: 8, marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={updateOrganization} disabled={updatingOrg || !editOrgName}>
                {updatingOrg ? '수정 중...' : '✅ 저장'}
              </button>
              <button className="btn btn-ghost" onClick={() => setEditingOrg(null)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 사용자 수정 모달 */}
      {editingUser && (
        <div className="overlay" onClick={() => { setEditingUser(null); setShowTransferUI(false); setTransferTarget('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">사용자 정보 수정</div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 4 }}>{editingUser.email}</div>
              </div>
              <button className="modal-close" onClick={() => { setEditingUser(null); setShowTransferUI(false); setTransferTarget('') }}>✕</button>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">이름</label>
              <input className="form-input" value={editFullName} onChange={e => setEditFullName(e.target.value)} placeholder="홍길동" />
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">역할</label>
                <select className="form-select" value={editRole} onChange={e => setEditRole(e.target.value)}>
                  <option value="admin">Super Admin</option>
                  <optgroup label="써치펌">
                    <option value="owner">Owner (관리자)</option>
                    <option value="headhunter">Headhunter</option>
                    <option value="operator">Operator (직원)</option>
                  </optgroup>
                  <optgroup label="채용사">
                    <option value="manager">Manager</option>
                  </optgroup>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">조직</label>
                <select className="form-select" value={editOrgId} onChange={e => setEditOrgId(e.target.value)}>
                  <option value="">조직 없음</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">🔒 새 비밀번호 (선택사항)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showEditPassword ? 'text' : 'password'}
                  className="form-input"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="비밀번호를 변경하려면 입력하세요"
                  style={{ paddingRight: 45 }}
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    fontSize: 12,
                    color: 'var(--muted2)',
                    borderRadius: 4,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted2)'}
                >
                  {showEditPassword ? '숨기기' : '보기'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                입력하지 않으면 비밀번호가 변경되지 않습니다. 최소 6자 이상 권장.
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={e => setEditIsActive(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span className="form-label" style={{ marginBottom: 0 }}>활성 계정</span>
              </label>
            </div>

            {/* Manager 권한 설정 (JOBIZIC Manager만) */}
            {editRole === 'manager' && editOrgId === '369e2e56-3648-4d94-8413-a5b7dc07888c' && (
              <div style={{ padding: 16, background: 'var(--bg3)', borderRadius: 8, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  🔐 권한 설정 (JOBIZIC Manager)
                </div>

                {/* JD 관리 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>JD 관리</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editPermissions.jd.read}
                        onChange={e => setEditPermissions({ ...editPermissions, jd: { ...editPermissions.jd, read: e.target.checked } })}
                        style={{ width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 12 }}>조회</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editPermissions.jd.write}
                        onChange={e => setEditPermissions({ ...editPermissions, jd: { ...editPermissions.jd, write: e.target.checked } })}
                        style={{ width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 12 }}>수정</span>
                    </label>
                  </div>
                </div>

                {/* 후보자 관리 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>후보자 관리</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editPermissions.candidate.read}
                        onChange={e => setEditPermissions({ ...editPermissions, candidate: { ...editPermissions.candidate, read: e.target.checked } })}
                        style={{ width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 12 }}>조회</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editPermissions.candidate.write}
                        onChange={e => setEditPermissions({ ...editPermissions, candidate: { ...editPermissions.candidate, write: e.target.checked } })}
                        style={{ width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 12 }}>수정</span>
                    </label>
                  </div>
                </div>

                {/* 파이프라인 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>파이프라인</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editPermissions.pipeline.read}
                        onChange={e => setEditPermissions({ ...editPermissions, pipeline: { ...editPermissions.pipeline, read: e.target.checked } })}
                        style={{ width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 12 }}>조회</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editPermissions.pipeline.write}
                        onChange={e => setEditPermissions({ ...editPermissions, pipeline: { ...editPermissions.pipeline, write: e.target.checked } })}
                        style={{ width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 12 }}>수정</span>
                    </label>
                  </div>
                </div>

                {/* 후보자 추천 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>후보자 추천</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editPermissions.recommendation.execute}
                      onChange={e => setEditPermissions({ ...editPermissions, recommendation: { execute: e.target.checked } })}
                      style={{ width: 14, height: 14 }}
                    />
                    <span style={{ fontSize: 12 }}>AI 추천 실행</span>
                  </label>
                </div>

                {/* 게시판 */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>게시판</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editPermissions.board.read}
                        onChange={e => setEditPermissions({ ...editPermissions, board: { ...editPermissions.board, read: e.target.checked } })}
                        style={{ width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 12 }}>조회</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editPermissions.board.write}
                        onChange={e => setEditPermissions({ ...editPermissions, board: { ...editPermissions.board, write: e.target.checked } })}
                        style={{ width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 12 }}>작성</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 업무 이관 UI */}
            {showTransferUI && (
              <div style={{ padding: 16, background: 'var(--bg3)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--danger)' }}>
                  🚨 업무 이관 필요
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 16 }}>
                  이 사용자를 비활성화하려면 담당 업무를 다른 멤버에게 이관해야 합니다.
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">이관받을 멤버</label>
                  <select
                    className="form-select"
                    value={transferTarget}
                    onChange={e => setTransferTarget(e.target.value)}
                  >
                    <option value="">멤버 선택</option>
                    {users
                      .filter(u =>
                        u.id !== editingUser.id &&
                        u.is_active &&
                        u.organization_id === editingUser.organization_id
                      )
                      .map(u => (
                        <option key={u.id} value={u.email}>
                          {u.full_name || u.email} ({u.role})
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={transferWork}
                    disabled={transferring || !transferTarget}
                  >
                    {transferring ? '이관 중...' : '✅ 업무 이관 & 비활성화'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setShowTransferUI(false)
                      setEditIsActive(true) // 체크박스 되돌리기
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div style={{ padding: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid var(--danger)', borderRadius: 8, marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={updateUser} disabled={updatingUser || showTransferUI}>
                {updatingUser ? '수정 중...' : '✅ 저장'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setEditingUser(null); setShowTransferUI(false); setTransferTarget('') }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

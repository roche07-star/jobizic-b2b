'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface Organization {
  id: string
  name: string
  type: string
  contact_email: string
  contact_phone?: string
  status: string
  created_at: string
}

interface User {
  id: string
  email: string
  full_name: string | null
  role: string
  organization_id: string | null
  is_active: boolean
  organizations: { id: string; name: string; type: string } | null
  created_at: string
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
  const [creatingUser, setCreatingUser] = useState(false)

  // 사용자 수정 폼
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editOrgId, setEditOrgId] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [updatingUser, setUpdatingUser] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProfile().then(p => {
      if (!p || p.role !== 'admin') {
        router.push('/')
        return
      }
      setProfile(p)
      loadData()
    })
  }, [])

  async function loadData() {
    try {
      const [orgsRes, usersRes] = await Promise.all([
        fetch('/api/admin/organizations'),
        fetch('/api/admin/users'),
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

      if (orgAdminEmail) {
        if (data.invited_user) {
          const devPw = data.invited_user.dev_password
          if (devPw) {
            alert(`✅ [개발 모드] 조직 & 사용자 생성 완료!\n\n로그인 정보:\n이메일: ${orgAdminEmail}\n비밀번호: ${devPw}`)
          } else {
            alert(`✅ 조직이 생성되고 ${orgAdminEmail}로 초대 이메일이 발송되었습니다!`)
          }
        } else {
          alert(`✅ 조직은 생성되었으나 사용자 생성에 실패했습니다.\n수동으로 사용자를 추가해주세요.`)
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
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await loadData() // 새로고침
      setShowUserForm(false)
      setUserEmail('')
      setUserFullName('')
      setUserOrgId('')
      alert('✅ 초대 이메일이 발송되었습니다!')
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
  }

  async function updateUser() {
    if (!editingUser) return
    setUpdatingUser(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editFullName,
          role: editRole,
          organization_id: editOrgId || null,
          is_active: editIsActive,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await loadData() // 새로고침
      setEditingUser(null)
      alert('✅ 사용자 정보가 수정되었습니다!')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUpdatingUser(false)
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

  if (!profile || profile.role !== 'admin') {
    return null
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-title">관리자 대시보드</div>
          <div className="page-sub">조직 & 사용자 관리</div>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid var(--danger)', borderRadius: 8, marginBottom: 20, color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* 조직 관리 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>조직 관리 ({organizations.length})</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowOrgForm(!showOrgForm)}>
            + 조직 생성
          </button>
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
                  <option value="headhunter">헤드헌터</option>
                  <option value="enterprise">기업</option>
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
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 12, padding: 8, background: 'var(--bg)', borderRadius: 6 }}>
                📧 {orgAdminEmail}로 초대 이메일이 자동 발송됩니다.
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
                  <option value="admin">관리자</option>
                  <option value="headhunter">헤드헌터</option>
                  <option value="client">고객사</option>
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
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12, padding: 10, background: 'var(--bg)', borderRadius: 6 }}>
              📧 사용자에게 초대 이메일이 발송됩니다. 이메일 링크를 통해 비밀번호를 설정할 수 있습니다.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={createUser} disabled={creatingUser || !userEmail}>
                {creatingUser ? '발송 중...' : '📧 초대 이메일 발송'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowUserForm(false)}>취소</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 8 }}>
          {users.map(user => (
            <div key={user.id} style={{ padding: 12, background: 'var(--bg3)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{user.email}</div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
                  {user.full_name || '이름 없음'} · {user.role}
                  {user.organizations && ` · ${user.organizations.name}`}
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
                  <option value="headhunter">헤드헌터</option>
                  <option value="enterprise">기업</option>
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
        <div className="overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">사용자 정보 수정</div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 4 }}>{editingUser.email}</div>
              </div>
              <button className="modal-close" onClick={() => setEditingUser(null)}>✕</button>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">이름</label>
              <input className="form-input" value={editFullName} onChange={e => setEditFullName(e.target.value)} placeholder="홍길동" />
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">역할</label>
                <select className="form-select" value={editRole} onChange={e => setEditRole(e.target.value)}>
                  <option value="admin">관리자</option>
                  <option value="headhunter">헤드헌터</option>
                  <option value="client">고객사</option>
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

            {error && (
              <div style={{ padding: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid var(--danger)', borderRadius: 8, marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={updateUser} disabled={updatingUser}>
                {updatingUser ? '수정 중...' : '✅ 저장'}
              </button>
              <button className="btn btn-ghost" onClick={() => setEditingUser(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

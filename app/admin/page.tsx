'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface Organization {
  id: string
  name: string
  type: string
  contact_email: string
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
  const [creatingOrg, setCreatingOrg] = useState(false)

  // 사용자 생성 폼
  const [showUserForm, setShowUserForm] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userFullName, setUserFullName] = useState('')
  const [userRole, setUserRole] = useState('headhunter')
  const [userOrgId, setUserOrgId] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)

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
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setOrganizations([data, ...organizations])
      setShowOrgForm(false)
      setOrgName('')
      setOrgEmail('')
      setOrgPhone('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreatingOrg(false)
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
                <label className="form-label">이메일</label>
                <input className="form-input" type="email" value={orgEmail} onChange={e => setOrgEmail(e.target.value)} placeholder="contact@abc.com" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={createOrganization} disabled={creatingOrg || !orgName}>
                {creatingOrg ? '생성 중...' : '생성'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowOrgForm(false)}>취소</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 8 }}>
          {organizations.map(org => (
            <div key={org.id} style={{ padding: 12, background: 'var(--bg3)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{org.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
                  {org.type} · {org.contact_email || '이메일 없음'}
                </div>
              </div>
              <span className={`badge badge-${org.status}`}>{org.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 사용자 관리 */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>사용자 관리 ({users.length})</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowUserForm(!showUserForm)}>
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
              <div>
                <div style={{ fontWeight: 600 }}>{user.email}</div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
                  {user.full_name || '이름 없음'} · {user.role}
                  {user.organizations && ` · ${user.organizations.name}`}
                </div>
              </div>
              <span className={`badge ${user.is_active ? 'badge-활성' : 'badge-보류'}`}>
                {user.is_active ? '활성' : '비활성'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

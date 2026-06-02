'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getProfile } from '@/lib/auth'

interface JD {
  id: string
  company: string | null
  position: string
  location: string | null
  salary_estimate: string | null
  priority: string
  difficulty: string
  status: string
  required_skills: string[]
  key_points: string[]
  target_profile: string
  search_strategy: string
  difficulty_reason: string
  keywords: string[]
  raw_text: string | null
  created_at: string
}

const STATUS_FILTERS = ['전체', '검토중', '활성', '마감', '보류']

interface Organization {
  id: string
  name: string
}

export default function JDPage() {
  const [jds, setJds] = useState<JD[]>([])
  const [loading, setLoading] = useState(true)
  const [showRawText, setShowRawText] = useState(false)
  const [filter, setFilter] = useState('전체')
  const [selected, setSelected] = useState<JD | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('전체')

  useEffect(() => {
    async function loadOrganizations() {
      const profile = await getProfile()
      if (!profile) return

      setIsAdmin(profile.role === 'admin')

      if (profile.role === 'admin') {
        const res = await fetch('/api/admin/organizations')
        const data = await res.json()
        setOrganizations(data.organizations ?? [])
      }
    }
    loadOrganizations()
  }, [])

  useEffect(() => {
    async function loadJDs() {
      const profile = await getProfile()
      if (!profile) return

      const params = new URLSearchParams({
        role: profile.role,
        ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
        ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
      })

      fetch(`/api/jd?${params}`)
        .then(r => r.json())
        .then(d => setJds(d.jds ?? []))
        .finally(() => setLoading(false))
    }
    loadJDs()
  }, [selectedOrgId])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/jd/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setJds(prev => prev.map(j => j.id === id ? { ...j, status } : j))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev)
  }

  async function deleteJD(id: string) {
    if (!confirm('이 JD를 삭제할까요?')) return
    await fetch(`/api/jd/${id}`, { method: 'DELETE' })
    setJds(prev => prev.filter(j => j.id !== id))
    if (selected?.id === id) closeModal()
  }

  function closeModal() {
    setSelected(null)
    setShowRawText(false)
  }

  const filtered = filter === '전체' ? jds : jds.filter(j => j.status === filter)

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-title">JD 관리</div>
          <div className="page-sub">총 {jds.length}건</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {isAdmin && organizations.length > 0 && (
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg-2)',
                color: 'var(--text)',
                fontSize: 13
              }}
            >
              <option value="전체">전체 조직</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
          <Link href="/jd/new">
            <button className="btn btn-primary">+ JD 등록</button>
          </Link>
        </div>
      </div>

      <div className="filter-bar">
        {STATUS_FILTERS.map(f => (
          <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f} {f !== '전체' && <span style={{ opacity: 0.6 }}>({jds.filter(j => j.status === f).length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <div className="empty-text">등록된 JD가 없습니다</div>
          <div className="empty-sub">JD 등록 버튼으로 채용공고를 추가하세요</div>
        </div>
      ) : (
        <div className="jd-grid">
          {filtered.map(jd => (
            <div key={jd.id} className="jd-card" onClick={() => setSelected(jd)}>
              <div className="jd-card-top">
                <div className="jd-company">{jd.company ?? '회사명 미상'}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span className={`badge badge-${jd.priority}`}>{jd.priority}</span>
                  <span className={`badge badge-${jd.status}`}>{jd.status}</span>
                </div>
              </div>
              <div className="jd-position">{jd.position}</div>
              <div className="jd-meta">
                {jd.location && <span className="jd-tag">📍 {jd.location}</span>}
                {jd.salary_estimate && <span className="jd-tag">💰 {jd.salary_estimate}</span>}
                <span className={`jd-tag badge-${jd.difficulty}`}>난이도 {jd.difficulty}</span>
              </div>
              {jd.required_skills?.length > 0 && (
                <div className="skills-wrap" style={{ marginTop: 10 }}>
                  {jd.required_skills.slice(0, 4).map(s => <span key={s} className="skill-chip">{s}</span>)}
                  {jd.required_skills.length > 4 && <span className="skill-chip" style={{ opacity: 0.5 }}>+{jd.required_skills.length - 4}</span>}
                </div>
              )}
              <div className="jd-actions" onClick={e => e.stopPropagation()}>
                {jd.status === '검토중' && (
                  <button className="btn btn-success btn-sm" onClick={() => updateStatus(jd.id, '활성')}>활성화</button>
                )}
                {jd.status !== '보류' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(jd.id, '보류')}>보류</button>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => deleteJD(jd.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div className="overlay" onClick={() => closeModal()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4 }}>{selected.company ?? '회사명 미상'}</div>
                <div className="modal-title">{selected.position}</div>
              </div>
              <button className="modal-close" onClick={() => closeModal()}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              <span className={`badge badge-${selected.priority}`}>{selected.priority}</span>
              <span className={`badge badge-${selected.status}`}>{selected.status}</span>
              <span className={`badge badge-${selected.difficulty}`}>난이도 {selected.difficulty}</span>
            </div>

            <div className="form-row" style={{ marginBottom: 16 }}>
              {selected.location && <div><span className="form-label">근무지</span><div>{selected.location}</div></div>}
              {selected.salary_estimate && <div><span className="form-label">예상 연봉</span><div>{selected.salary_estimate}</div></div>}
            </div>

            {selected.required_skills?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">필수 스킬</div>
                <div className="skills-wrap">
                  {selected.required_skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
                </div>
              </div>
            )}

            <div className="analysis-box" style={{ marginBottom: 16 }}>
              <div className="analysis-row">
                <span className="analysis-label">난이도</span>
                <span className="analysis-value">{selected.difficulty_reason}</span>
              </div>
              <div className="analysis-row">
                <span className="analysis-label">타깃 프로파일</span>
                <span className="analysis-value">{selected.target_profile}</span>
              </div>
              <div className="analysis-row">
                <span className="analysis-label">서칭 전략</span>
                <span className="analysis-value">{selected.search_strategy}</span>
              </div>
            </div>

            {selected.key_points?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="form-label">헤드헌터 주목 포인트</div>
                <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selected.key_points.map((p, i) => <li key={i} style={{ fontSize: 13 }}>{p}</li>)}
                </ul>
              </div>
            )}

            {selected.raw_text && (
              <div style={{ marginBottom: 20 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowRawText(!showRawText)}
                  style={{ marginBottom: 12 }}
                >
                  {showRawText ? '원문 숨기기 ▲' : 'JD 원문 보기 ▼'}
                </button>
                {showRawText && (
                  <div style={{
                    padding: 16,
                    background: 'var(--bg-2)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    maxHeight: 400,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: 'var(--text)'
                  }}>
                    {selected.raw_text}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {selected.status === '검토중' && (
                <button className="btn btn-success" onClick={() => updateStatus(selected.id, '활성')}>활성화</button>
              )}
              {selected.status === '활성' && (
                <button className="btn btn-ghost" onClick={() => updateStatus(selected.id, '마감')}>마감</button>
              )}
              {selected.status !== '검토중' && (
                <button className="btn btn-ghost" onClick={() => updateStatus(selected.id, '검토중')}>검토중으로</button>
              )}
              <button className="btn btn-danger" onClick={() => { deleteJD(selected.id); closeModal() }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

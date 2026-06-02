'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getProfile } from '@/lib/auth'

interface PipelineInfo {
  id: string
  stage: string
  is_active: boolean
  job_descriptions: {
    company: string | null
    position: string
  }
}

interface Candidate {
  id: string
  name: string
  email: string | null
  phone: string | null
  location: string | null
  current_company: string | null
  current_position: string | null
  total_experience_years: number | null
  career_summary: string
  skills: string[]
  tech_stack: string[]
  ideal_roles: string[]
  market_value: string
  strength_summary: string
  career_trajectory: string
  key_highlights: string[]
  tags: string[]
  status: string
  job_search_status: string
  created_at: string
  pipeline?: PipelineInfo[]
}

const STATUS_FILTERS = ['전체', '검토중', '활성', '제안중', '합격', '보류']

interface Organization {
  id: string
  name: string
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Candidate | null>(null)
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
    async function loadCandidates() {
      const profile = await getProfile()
      if (!profile) return

      const params = new URLSearchParams({
        role: profile.role,
        ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
        ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
      })

      fetch(`/api/candidates?${params}`)
        .then(r => r.json())
        .then(d => setCandidates(d.candidates ?? []))
        .finally(() => setLoading(false))
    }
    loadCandidates()
  }, [selectedOrgId])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/candidates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev)
  }

  async function deleteCandidate(id: string) {
    if (!confirm('이 후보자를 삭제할까요?')) return
    await fetch(`/api/candidates/${id}`, { method: 'DELETE' })
    setCandidates(prev => prev.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const filtered = filter === '전체' ? candidates : candidates.filter(c => c.status === filter)
  const searched = search.trim()
    ? filtered.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.current_company?.toLowerCase().includes(search.toLowerCase()) ||
        c.current_position?.toLowerCase().includes(search.toLowerCase())
      )
    : filtered

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-title">후보자 관리</div>
          <div className="page-sub">총 {candidates.length}명</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {isAdmin && organizations.length > 0 && (
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '2px solid var(--accent)',
                background: 'var(--bg)',
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <option value="전체">🏢 전체 조직</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
          <Link href="/candidates/new">
            <button className="btn btn-primary">+ 후보자 등록</button>
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder="🔍 이름, 이메일, 회사, 포지션 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-bar">
        {STATUS_FILTERS.map(f => (
          <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f} {f !== '전체' && <span style={{ opacity: 0.6 }}>({candidates.filter(c => c.status === f).length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} /></div>
      ) : searched.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">👤</div>
          <div className="empty-text">등록된 후보자가 없습니다</div>
          <div className="empty-sub">후보자 등록 버튼으로 이력서를 추가하세요</div>
        </div>
      ) : (
        <div className="jd-grid">
          {searched.map(candidate => (
            <div key={candidate.id} className="jd-card" onClick={() => setSelected(candidate)}>
              <div className="jd-card-top">
                <div className="jd-company">{candidate.current_company ?? '프리랜서'}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span className={`badge badge-${candidate.status}`}>{candidate.status}</span>
                </div>
              </div>
              <div className="jd-position" style={{ marginBottom: 4 }}>{candidate.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 10 }}>
                {candidate.current_position ?? '—'} · {candidate.total_experience_years ? `${candidate.total_experience_years}년` : '경력 미상'}
              </div>
              <div className="jd-meta">
                {candidate.location && <span className="jd-tag">📍 {candidate.location}</span>}
                {candidate.market_value && <span className="jd-tag">💰 {candidate.market_value}</span>}
                <span className={`jd-tag badge-${candidate.job_search_status}`}>{candidate.job_search_status}</span>
              </div>
              {candidate.pipeline && candidate.pipeline.filter(p => p.is_active).length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {candidate.pipeline.filter(p => p.is_active).map(p => (
                    <span
                      key={p.id}
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: 'var(--accent)',
                        color: 'var(--bg)',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      🔄 {p.job_descriptions.company ?? '회사'} - {p.stage}
                    </span>
                  ))}
                </div>
              )}
              {(candidate.skills?.length > 0 || candidate.tech_stack?.length > 0) && (
                <div className="skills-wrap" style={{ marginTop: 10 }}>
                  {[...(candidate.skills ?? []), ...(candidate.tech_stack ?? [])].slice(0, 5).map(s => <span key={s} className="skill-chip">{s}</span>)}
                  {([...(candidate.skills ?? []), ...(candidate.tech_stack ?? [])].length > 5) && <span className="skill-chip" style={{ opacity: 0.5 }}>+{([...(candidate.skills ?? []), ...(candidate.tech_stack ?? [])].length - 5)}</span>}
                </div>
              )}
              <div className="jd-actions" onClick={e => e.stopPropagation()}>
                {candidate.status === '검토중' && (
                  <button className="btn btn-success btn-sm" onClick={() => updateStatus(candidate.id, '활성')}>활성화</button>
                )}
                {candidate.status === '활성' && (
                  <button className="btn btn-primary btn-sm" onClick={() => updateStatus(candidate.id, '제안중')}>제안</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(candidate.id, '보류')}>보류</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteCandidate(candidate.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4 }}>{selected.current_company ?? '프리랜서'} · {selected.current_position}</div>
                <div className="modal-title">{selected.name}</div>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              <span className={`badge badge-${selected.status}`}>{selected.status}</span>
              <span className={`badge badge-${selected.job_search_status}`}>{selected.job_search_status}</span>
              {selected.total_experience_years && <span className="badge badge-일반">{selected.total_experience_years}년 경력</span>}
            </div>

            <div className="form-row" style={{ marginBottom: 16 }}>
              {selected.email && <div><span className="form-label">이메일</span><div>{selected.email}</div></div>}
              {selected.phone && <div><span className="form-label">전화</span><div>{selected.phone}</div></div>}
              {selected.location && <div><span className="form-label">거주지</span><div>{selected.location}</div></div>}
              {selected.market_value && <div><span className="form-label">시장가치</span><div>{selected.market_value}</div></div>}
            </div>

            {selected.career_summary && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">경력 요약</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{selected.career_summary}</div>
              </div>
            )}

            {(selected.skills?.length > 0 || selected.tech_stack?.length > 0) && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">스킬 & 기술스택</div>
                <div className="skills-wrap">
                  {[...(selected.skills ?? []), ...(selected.tech_stack ?? [])].map(s => <span key={s} className="skill-chip">{s}</span>)}
                </div>
              </div>
            )}

            <div className="analysis-box" style={{ marginBottom: 16 }}>
              <div className="analysis-row">
                <span className="analysis-label">강점 요약</span>
                <span className="analysis-value">{selected.strength_summary}</span>
              </div>
              <div className="analysis-row">
                <span className="analysis-label">커리어 방향</span>
                <span className="analysis-value">{selected.career_trajectory}</span>
              </div>
            </div>

            {selected.ideal_roles?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">적합한 포지션</div>
                <div className="skills-wrap">
                  {selected.ideal_roles.map(r => <span key={r} className="skill-chip preferred">{r}</span>)}
                </div>
              </div>
            )}

            {selected.key_highlights?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="form-label">주요 하이라이트</div>
                <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selected.key_highlights.map((h, i) => <li key={i} style={{ fontSize: 13 }}>{h}</li>)}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {selected.status === '검토중' && (
                <button className="btn btn-success" onClick={() => updateStatus(selected.id, '활성')}>활성화</button>
              )}
              {selected.status === '활성' && (
                <button className="btn btn-primary" onClick={() => updateStatus(selected.id, '제안중')}>제안</button>
              )}
              {selected.status === '제안중' && (
                <button className="btn btn-success" onClick={() => updateStatus(selected.id, '합격')}>합격</button>
              )}
              {selected.status !== '검토중' && (
                <button className="btn btn-ghost" onClick={() => updateStatus(selected.id, '검토중')}>검토중으로</button>
              )}
              <button className="btn btn-danger" onClick={() => { deleteCandidate(selected.id); setSelected(null) }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

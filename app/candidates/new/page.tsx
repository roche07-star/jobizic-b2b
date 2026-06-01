'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile } from '@/lib/auth'

interface ParsedCandidate {
  name: string
  email: string | null
  phone: string | null
  location: string | null
  current_company: string | null
  current_position: string | null
  total_experience_years: number | null
  career_summary: string
  education: string[]
  skills: string[]
  tech_stack: string[]
  certifications: string[]
  languages: string[]
  desired_position: string | null
  desired_salary: string | null
  desired_location: string | null
  job_search_status: string
  strength_summary: string
  career_trajectory: string
  ideal_roles: string[]
  market_value: string
  key_highlights: string[]
  tags: string[]
}

export default function CandidateNewPage() {
  const router = useRouter()
  const [rawResume, setRawResume] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedCandidate | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleParse() {
    if (!rawResume.trim()) return
    setParsing(true)
    setError(null)
    setParsed(null)
    try {
      const res = await fetch('/api/candidates/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawResume }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setParsed(data)
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    if (!parsed) return
    setSaving(true)
    try {
      // organization_id 가져오기
      const profile = await getProfile()
      if (!profile?.organization_id) {
        setError('조직 정보가 없습니다. 관리자에게 문의하세요.')
        setSaving(false)
        return
      }

      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parsed,
          raw_resume: rawResume,
          status: '검토중',
          source: '수동',
          organization_id: profile.organization_id
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push(`/candidates`)
    } catch {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-title">후보자 등록</div>
          <div className="page-sub">이력서를 붙여넣으면 AI가 자동으로 분석합니다</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: parsed ? '1fr 1fr' : '1fr', gap: 20 }}>

        {/* 입력 영역 */}
        <div className="card">
          <div className="card-title">이력서 원문 입력</div>
          <div className="form-group">
            <textarea
              className="form-textarea"
              style={{ minHeight: 320 }}
              placeholder="이력서 전체 내용을 여기에 붙여넣으세요.&#10;&#10;이메일, 링크드인, 사람인, 잡코리아 등 어디서든 복사해서 붙여넣으면 됩니다."
              value={rawResume}
              onChange={e => setRawResume(e.target.value)}
            />
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleParse}
              disabled={!rawResume.trim() || parsing}
            >
              {parsing ? <><div className="spinner" /> 분석 중...</> : '🤖 AI 파싱'}
            </button>
            {parsed && (
              <button className="btn btn-ghost" onClick={() => { setParsed(null); setRawResume('') }}>
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 파싱 결과 */}
        {parsed && (
          <div className="card" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>AI 분석 결과</span>
              <span className={`badge badge-${parsed.job_search_status}`}>{parsed.job_search_status}</span>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">이름</label>
                <input className="form-input" value={parsed.name} onChange={e => setParsed(p => p ? { ...p, name: e.target.value } : p)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">이메일</label>
                <input className="form-input" value={parsed.email ?? ''} onChange={e => setParsed(p => p ? { ...p, email: e.target.value } : p)} />
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">전화번호</label>
                <input className="form-input" value={parsed.phone ?? ''} onChange={e => setParsed(p => p ? { ...p, phone: e.target.value } : p)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">거주지</label>
                <input className="form-input" value={parsed.location ?? ''} onChange={e => setParsed(p => p ? { ...p, location: e.target.value } : p)} />
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">현재 회사</label>
                <input className="form-input" value={parsed.current_company ?? ''} onChange={e => setParsed(p => p ? { ...p, current_company: e.target.value } : p)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">현재 포지션</label>
                <input className="form-input" value={parsed.current_position ?? ''} onChange={e => setParsed(p => p ? { ...p, current_position: e.target.value } : p)} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">총 경력</label>
              <input className="form-input" type="number" value={parsed.total_experience_years ?? ''} onChange={e => setParsed(p => p ? { ...p, total_experience_years: parseInt(e.target.value) } : p)} />
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">경력 요약</label>
              <textarea className="form-textarea" style={{ minHeight: 80 }} value={parsed.career_summary} onChange={e => setParsed(p => p ? { ...p, career_summary: e.target.value } : p)} />
            </div>

            {parsed.skills?.length > 0 && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">스킬</label>
                <div className="skills-wrap">
                  {parsed.skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
                </div>
              </div>
            )}

            {parsed.tech_stack?.length > 0 && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">기술 스택</label>
                <div className="skills-wrap">
                  {parsed.tech_stack.map(s => <span key={s} className="skill-chip">{s}</span>)}
                </div>
              </div>
            )}

            {parsed.education?.length > 0 && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">학력</label>
                {parsed.education.map((e, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{e}</div>
                ))}
              </div>
            )}

            <div className="analysis-box" style={{ marginBottom: 12 }}>
              <div className="analysis-row">
                <span className="analysis-label">강점 요약</span>
                <span className="analysis-value">{parsed.strength_summary}</span>
              </div>
              <div className="analysis-row">
                <span className="analysis-label">커리어 방향</span>
                <span className="analysis-value">{parsed.career_trajectory}</span>
              </div>
              <div className="analysis-row">
                <span className="analysis-label">시장 가치</span>
                <span className="analysis-value">{parsed.market_value}</span>
              </div>
            </div>

            {parsed.ideal_roles?.length > 0 && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">적합한 포지션</label>
                <div className="skills-wrap">
                  {parsed.ideal_roles.map(r => <span key={r} className="skill-chip preferred">{r}</span>)}
                </div>
              </div>
            )}

            {parsed.key_highlights?.length > 0 && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">주요 하이라이트</label>
                <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {parsed.key_highlights.map((h, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text)' }}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '✅ 후보자 저장'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

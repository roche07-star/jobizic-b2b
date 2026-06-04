'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile } from '@/lib/auth'

interface ParsedJD {
  company: string | null
  position: string
  location: string | null
  salary: string | null
  deadline: string
  keywords: string[]
  required_skills: string[]
  preferred_skills: string[]
  priority: '긴급' | '중요' | '일반'
  difficulty: '상' | '중' | '하'
  difficulty_reason: string
  target_profile: string
  search_strategy: string
  salary_estimate: string
  key_points: string[]
}

export default function JDNewPage() {
  const router = useRouter()
  const [rawText, setRawText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedJD | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleParse() {
    if (!rawText.trim()) return
    setParsing(true)
    setError(null)
    setParsed(null)
    try {
      const res = await fetch('/api/jd/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
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

      const res = await fetch('/api/jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parsed,
          raw_text: rawText,
          status: '검토중',
          source: '수동',
          organization_id: profile.organization_id,
          created_by: profile.email
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push(`/jd`)
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
          <div className="page-title">JD 등록</div>
          <div className="page-sub">채용공고를 붙여넣으면 AI가 자동으로 분석합니다</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: parsed ? '1fr 1fr' : '1fr', gap: 20 }}>

        {/* 입력 영역 */}
        <div className="card">
          <div className="card-title">JD 원문 입력</div>
          <div className="form-group">
            <textarea
              className="form-textarea"
              style={{ minHeight: 320 }}
              placeholder="채용공고 전체 내용을 여기에 붙여넣으세요.&#10;&#10;이메일로 받은 JD, 잡플래닛, 원티드, 링크드인 등 어디서든 복사해서 붙여넣으면 됩니다."
              value={rawText}
              onChange={e => setRawText(e.target.value)}
            />
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleParse}
              disabled={!rawText.trim() || parsing}
            >
              {parsing ? <><div className="spinner" /> 분석 중...</> : '🤖 AI 파싱'}
            </button>
            {parsed && (
              <button className="btn btn-ghost" onClick={() => { setParsed(null); setRawText('') }}>
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 파싱 결과 */}
        {parsed && (
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>AI 분석 결과</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className={`badge badge-${parsed.priority}`}>{parsed.priority}</span>
                <span className={`badge badge-${parsed.difficulty}`}>난이도 {parsed.difficulty}</span>
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">회사</label>
                <input className="form-input" value={parsed.company ?? ''} onChange={e => setParsed(p => p ? { ...p, company: e.target.value } : p)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">포지션</label>
                <input className="form-input" value={parsed.position} onChange={e => setParsed(p => p ? { ...p, position: e.target.value } : p)} />
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">근무지</label>
                <input className="form-input" value={parsed.location ?? ''} onChange={e => setParsed(p => p ? { ...p, location: e.target.value } : p)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">마감일</label>
                <input className="form-input" value={parsed.deadline} onChange={e => setParsed(p => p ? { ...p, deadline: e.target.value } : p)} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">예상 연봉</label>
              <input className="form-input" value={parsed.salary_estimate} onChange={e => setParsed(p => p ? { ...p, salary_estimate: e.target.value } : p)} />
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">필수 스킬</label>
              <div className="skills-wrap">
                {parsed.required_skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">우대 스킬</label>
              <div className="skills-wrap">
                {parsed.preferred_skills.map(s => <span key={s} className="skill-chip preferred">{s}</span>)}
              </div>
            </div>

            <div className="analysis-box" style={{ marginBottom: 12 }}>
              <div className="analysis-row">
                <span className="analysis-label">난이도</span>
                <span className="analysis-value">{parsed.difficulty_reason}</span>
              </div>
              <div className="analysis-row">
                <span className="analysis-label">타깃 프로파일</span>
                <span className="analysis-value">{parsed.target_profile}</span>
              </div>
              <div className="analysis-row">
                <span className="analysis-label">서칭 전략</span>
                <span className="analysis-value">{parsed.search_strategy}</span>
              </div>
            </div>

            {parsed.key_points.length > 0 && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">헤드헌터 주목 포인트</label>
                <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {parsed.key_points.map((p, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text)' }}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '✅ JD 저장'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

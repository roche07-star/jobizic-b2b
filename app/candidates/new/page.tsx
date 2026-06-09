'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile } from '@/lib/auth'

// 최종학력 추출 함수
function getFinalEducation(education: string[] | undefined): string {
  if (!education || education.length === 0) return ''

  // 학력 우선순위 (높은 순서)
  const priorities = [
    { keywords: ['박사', 'Ph.D', 'PhD', 'Doctor'], label: '박사' },
    { keywords: ['석사', 'Master', '대학원'], label: '석사' },
    { keywords: ['학사', '대학교', '대졸', 'Bachelor', '4년제'], label: '학사' },
    { keywords: ['전문학사', '전문대', '2년제'], label: '전문학사' },
    { keywords: ['고등학교', '고졸'], label: '고졸' },
  ]

  // 가장 높은 학력 찾기
  for (const priority of priorities) {
    const found = education.find(edu =>
      priority.keywords.some(keyword => edu.includes(keyword))
    )
    if (found) {
      // 수료인 경우 표시
      if (found.includes('수료')) {
        return `${priority.label} 수료`
      }
      return priority.label
    }
  }

  // 우선순위에 없으면 첫 번째 항목 반환 (최상단 = 최종학력)
  return education[0]
}

interface ParsedCandidate {
  name: string
  email: string | null
  phone: string | null
  birth_year: number | null
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
  weakness_summary: string
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

      // 중복 후보 체크 (이메일이 있을 경우)
      if (parsed.email) {
        const checkParams = new URLSearchParams({
          email: parsed.email,
          organization_id: profile.organization_id,
        })
        const checkRes = await fetch(`/api/candidates/check-duplicate?${checkParams}`)
        const checkData = await checkRes.json()

        if (checkData.exists) {
          const confirmed = confirm(
            `⚠️ 이미 등록된 후보자입니다:\n\n` +
            `이름: ${checkData.candidate.name}\n` +
            `등록자: ${checkData.candidate.created_by}\n` +
            `등록일: ${new Date(checkData.candidate.created_at).toLocaleDateString('ko-KR')}\n\n` +
            `그래도 등록하시겠습니까?`
          )
          if (!confirmed) {
            setSaving(false)
            return
          }
        }
      }

      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parsed,
          total_experience_years: parsed.total_experience_years ? Math.round(parsed.total_experience_years) : null,
          raw_resume: rawResume,
          status: '검토중',
          source: '수동',
          organization_id: profile.organization_id,
          created_by: profile.email
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

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">학력 (최종학력을 최상단에 입력, 줄바꿈으로 구분)</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="예:&#10;한밭대학교 융합기술학과 학사 졸업&#10;대전고등학교 졸업"
                value={parsed.education?.join('\n') ?? ''}
                onChange={e => {
                  const lines = e.target.value.split('\n').filter(line => line.trim())
                  setParsed(p => p ? { ...p, education: lines } : p)
                }}
              />
              {parsed.education && parsed.education.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)' }}>
                  ✓ 최종학력: {getFinalEducation(parsed.education)}
                </div>
              )}
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
                <label className="form-label">출생년도</label>
                <input className="form-input" type="number" placeholder="예: 1990" value={parsed.birth_year ?? ''} onChange={e => setParsed(p => p ? { ...p, birth_year: e.target.value ? parseInt(e.target.value) : null } : p)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">총 경력</label>
                <input className="form-input" type="number" value={parsed.total_experience_years ?? ''} onChange={e => setParsed(p => p ? { ...p, total_experience_years: e.target.value ? parseInt(e.target.value) : null } : p)} />
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

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

  // 고정 필드
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [feeRate, setFeeRate] = useState('')
  const [location, setLocation] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')
  const [recruitmentProcess, setRecruitmentProcess] = useState('')

  // JD 내용
  const [rawText, setRawText] = useState('')
  const [clientComment, setClientComment] = useState('')

  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedJD | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleParse() {
    if (!rawText.trim() || !company.trim() || !position.trim()) return
    setParsing(true)
    setError(null)
    setParsed(null)
    try {
      const res = await fetch('/api/jd/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          company_url: companyUrl.trim() || undefined,
          client_comment: clientComment.trim() || undefined
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }

      // AI 파싱 결과에 고정 필드 값 병합
      // 우선순위는 기본값 "보통"으로 설정 (유저가 수정 가능)
      setParsed({
        ...data,
        company,
        position,
        location: location || data.location,
        priority: '보통'
      })
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
          company,  // 고정 필드 값으로 덮어쓰기
          position,
          location,
          fee_rate: feeRate || null,
          company_url: companyUrl || null,
          recruitment_process: recruitmentProcess || null,
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
          <div className="card-title">JD 등록</div>

          {/* 고정 필드 */}
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">회사명 *</label>
              <input
                className="form-input"
                placeholder="예: 네이버"
                value={company}
                onChange={e => setCompany(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">포지션명 *</label>
              <input
                className="form-input"
                placeholder="예: Backend 개발자"
                value={position}
                onChange={e => setPosition(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">수수료율 *</label>
              <input
                className="form-input"
                placeholder="예: 20%"
                value={feeRate}
                onChange={e => setFeeRate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">근무지 *</label>
              <input
                className="form-input"
                placeholder="예: 서울 강남구"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">회사 URL <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(선택)</span></label>
            <input
              className="form-input"
              type="url"
              placeholder="예: https://www.company.com 또는 https://www.rocketpunch.com/companies/..."
              value={companyUrl}
              onChange={e => setCompanyUrl(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">채용절차 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(선택)</span></label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 100 }}
              placeholder="예:&#10;1차: 서류전형&#10;2차: 실무면접 (1~2시간)&#10;3차: 임원면접&#10;4차: 처우협의"
              value={recruitmentProcess}
              onChange={e => setRecruitmentProcess(e.target.value)}
            />
          </div>

          {/* JD 내용 */}
          <div className="form-group">
            <label className="form-label">JD 내용 *</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 280 }}
              placeholder="주요업무&#10;- 백엔드 API 개발 및 운영&#10;- 데이터베이스 설계 및 최적화&#10;&#10;자격조건&#10;- Node.js 또는 Java 개발 경력 3년 이상&#10;- RDBMS 실무 경험&#10;&#10;우대사항&#10;- AWS 클라우드 서비스 경험&#10;- MSA 아키텍처 설계 경험"
              value={rawText}
              onChange={e => setRawText(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">클라이언트 코멘트 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(선택)</span></label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 80 }}
              placeholder="예: 개발직군 채용 경험 필수, 스타트업 경험자 우대, 영어 실무 가능자만&#10;요건 완화/강화, 우선순위 변경, 기피 프로파일 등을 입력하세요."
              value={clientComment}
              onChange={e => setClientComment(e.target.value)}
            />
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleParse}
              disabled={!company.trim() || !position.trim() || !feeRate.trim() || !location.trim() || !rawText.trim() || parsing}
            >
              {parsing ? <><div className="spinner" /> 분석 중...</> : '🤖 AI 파싱'}
            </button>
            {parsed && (
              <button className="btn btn-ghost" onClick={() => {
                setParsed(null)
                setCompany('')
                setPosition('')
                setFeeRate('')
                setLocation('')
                setCompanyUrl('')
                setRecruitmentProcess('')
                setRawText('')
                setClientComment('')
              }}>
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 파싱 결과 */}
        {parsed && (
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>AI 분석 결과</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>우선순위:</label>
                <select
                  className="form-input"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
                  value={parsed.priority}
                  onChange={e => setParsed(p => p ? { ...p, priority: e.target.value as any } : p)}
                >
                  <option value="긴급">🔥 긴급</option>
                  <option value="높음">⬆️ 높음</option>
                  <option value="보통">보통</option>
                  <option value="낮음">⬇️ 낮음</option>
                </select>
              </div>
            </div>

            {/* 고정 필드 표시 (읽기 전용) */}
            <div className="analysis-box" style={{ marginBottom: 12, background: 'var(--surface-secondary)' }}>
              <div className="analysis-row">
                <span className="analysis-label">회사</span>
                <span className="analysis-value">{company}</span>
              </div>
              <div className="analysis-row">
                <span className="analysis-label">포지션</span>
                <span className="analysis-value">{position}</span>
              </div>
              <div className="analysis-row">
                <span className="analysis-label">수수료율</span>
                <span className="analysis-value">{feeRate}</span>
              </div>
              <div className="analysis-row">
                <span className="analysis-label">근무지</span>
                <span className="analysis-value">{location}</span>
              </div>
              {recruitmentProcess && (
                <div className="analysis-row">
                  <span className="analysis-label">채용절차</span>
                  <span className="analysis-value" style={{ whiteSpace: 'pre-line' }}>{recruitmentProcess}</span>
                </div>
              )}
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">마감일</label>
                <input className="form-input" value={parsed.deadline} onChange={e => setParsed(p => p ? { ...p, deadline: e.target.value } : p)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">예상 연봉</label>
                <input className="form-input" value={parsed.salary_estimate} onChange={e => setParsed(p => p ? { ...p, salary_estimate: e.target.value } : p)} />
              </div>
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

            {/* 회사 정보 분석 */}
            {(parsed as any)._v2?.company_analysis && (parsed as any)._v2.company_analysis.introduction !== '회사 정보 확인 불가' && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">회사 정보</label>
                <div className="analysis-box">
                  <div className="analysis-row">
                    <span className="analysis-label">회사 소개</span>
                    <span className="analysis-value">{(parsed as any)._v2.company_analysis.introduction}</span>
                  </div>
                  {(parsed as any)._v2.company_analysis.revenue !== '정보 부족' && (
                    <div className="analysis-row">
                      <span className="analysis-label">매출/규모</span>
                      <span className="analysis-value">{(parsed as any)._v2.company_analysis.revenue}</span>
                    </div>
                  )}
                  {(parsed as any)._v2.company_analysis.current_business !== '정보 부족' && (
                    <div className="analysis-row">
                      <span className="analysis-label">현재 사업</span>
                      <span className="analysis-value">{(parsed as any)._v2.company_analysis.current_business}</span>
                    </div>
                  )}
                  {(parsed as any)._v2.company_analysis.recent_trends !== '정보 부족' && (
                    <div className="analysis-row">
                      <span className="analysis-label">최근 동향</span>
                      <span className="analysis-value">{(parsed as any)._v2.company_analysis.recent_trends}</span>
                    </div>
                  )}
                  {(parsed as any)._v2.company_analysis.future_value !== '정보 부족' && (
                    <div className="analysis-row">
                      <span className="analysis-label">미래 가치</span>
                      <span className="analysis-value">{(parsed as any)._v2.company_analysis.future_value}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(parsed as any)._v2?.company_analysis?.introduction === '회사 정보 확인 불가' && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">회사 정보</label>
                <div style={{ padding: '12px', background: 'var(--surface-secondary)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  회사 정보 확인 불가
                </div>
              </div>
            )}

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

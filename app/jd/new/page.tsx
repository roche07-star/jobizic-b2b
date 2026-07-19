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

  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!rawText.trim() || !company.trim() || !position.trim()) {
      setError('필수 항목을 입력해주세요.')
      return
    }

    setError(null)

    try {
      // 1. Parse API 호출 (Job 생성)
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

      if (!res.ok) {
        setError(data.error)
        return
      }

      // 2. localStorage에 저장 (백그라운드 처리용)
      const { jobId } = data
      console.log('[jd/new] Job created:', jobId)

      localStorage.setItem('processing_job_id', jobId)
      localStorage.setItem('processing_job_type', 'jd')
      localStorage.setItem('processing_job_metadata', JSON.stringify({
        company,
        position,
        location,
        fee_rate: feeRate,
        company_url: companyUrl,
        recruitment_process: recruitmentProcess,
        raw_text: rawText
      }))

      // 3. Process API 백그라운드 호출
      fetch(`/api/jobs/${jobId}/process`, { method: 'POST' })
        .catch(err => console.error('[jd/new] Process error:', err))

      // 4. 1초 후 JD 목록으로 이동
      setTimeout(() => {
        router.push('/jd?processing=true')
      }, 1000)

    } catch {
      setError('서버 오류가 발생했습니다.')
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>

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
              onClick={handleSubmit}
              disabled={!company.trim() || !position.trim() || !feeRate.trim() || !location.trim() || !rawText.trim()}
              style={{ flex: 1 }}
            >
              🚀 JD 등록 (백그라운드 분석)
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

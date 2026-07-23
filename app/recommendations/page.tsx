'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ToastContainer'

interface JD {
  id: string
  company: string
  position: string
  status: string
  created_by: string
  created_at: string
  organization_id: string
  organizations: {
    name: string
  }
}

interface Recommendation {
  id: string
  match_score: number
  match_reason: string
  skill_match_rate: number
  experience_match: string
  strength_for_jd: string[]
  concerns: string[]
  recommendation: string
  next_steps: string
  status: string
  recommended_by: string | null
  recommended_to: string
  recommended_at: string | null
  responded_at?: string | null
  admin_comment: string | null
  pm_comment?: string | null
  job_descriptions: {
    id: string
    company: string
    position: string
    created_by?: string
  }
  candidates: {
    id: string
    name: string
    email?: string | null
    source?: string | null
    current_position: string | null
    total_experience_years: number | null
    education?: string[] | null
    career_summary?: string | null
    desired_salary?: string | null
    metadata?: any
  }
  created_at: string
}

export default function RecommendationsPage() {
  const { toasts, success, error, info, removeToast: onRemove } = useToast()
  const [userRole, setUserRole] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'received' | 'manage' | 'linkedin'>('received')

  // 내가 받은 추천 state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Recommendation | null>(null)
  const [responding, setResponding] = useState(false)
  const [commentText, setCommentText] = useState('')

  // 후보자 추천 관리 state
  const [activeJDs, setActiveJDs] = useState<JD[]>([])
  const [adminRecommendations, setAdminRecommendations] = useState<Recommendation[]>([])
  const [adminLoading, setAdminLoading] = useState(true)
  const [jdLoading, setJdLoading] = useState(true)
  const [adminSelected, setAdminSelected] = useState<Recommendation | null>(null)
  const [sending, setSending] = useState(false)
  const [adminCommentText, setAdminCommentText] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'recommended' | 'all'>('pending')
  const [recommendingJdId, setRecommendingJdId] = useState<string | null>(null)
  const [minScores, setMinScores] = useState<Record<string, number>>({})
  const [editedCurrentSalary, setEditedCurrentSalary] = useState<string>('')
  const [editedDesiredSalary, setEditedDesiredSalary] = useState<string>('')
  const [editedEducation, setEditedEducation] = useState<string>('')
  const [editedCareerSummary, setEditedCareerSummary] = useState<string>('')

  // LinkedIn 검색 state
  const [linkedinSearching, setLinkedinSearching] = useState(false)
  const [linkedinResults, setLinkedinResults] = useState<any[]>([])
  const [selectedJdForLinkedin, setSelectedJdForLinkedin] = useState<string>('')
  const [linkedinKeywords, setLinkedinKeywords] = useState<any>(null)
  const [linkedinSearchUrls, setLinkedinSearchUrls] = useState<any[]>([])

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (userRole) {
      if (activeTab === 'received') {
        loadRecommendations()
      } else if (activeTab === 'manage' && (userRole === 'admin' || userRole === 'owner' || userRole === 'headhunter')) {
        loadActiveJDs()
        loadAdminRecommendations()
      } else if (activeTab === 'linkedin' && (userRole === 'admin' || userRole === 'owner' || userRole === 'headhunter')) {
        loadActiveJDs()
      }
    }
  }, [userRole, activeTab, statusFilter])

  async function checkAuth() {
    const profile = await getProfile()
    if (profile) {
      setUserRole(profile.role)
    }
  }

  // === 내가 받은 추천 함수들 ===
  async function loadRecommendations() {
    setLoading(true)
    try {
      // 내가 받은 추천만 조회 (for_me=true 파라미터)
      const res = await fetch('/api/jd/recommendations?for_me=true')
      const data = await res.json()

      if (res.ok) {
        setRecommendations(data.recommendations || [])
      }
    } catch (err) {
      console.error('[recommendations] Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function deleteRecommendation(id: string) {
    if (!confirm('이 추천을 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/jd/recommendations/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        error(`❌ ${data.error || '삭제 실패'}`)
        return
      }

      success('✅ 삭제되었습니다.')
      loadRecommendations()

    } catch (err) {
      console.error('[deleteRecommendation] Error:', err)
      error('❌ 삭제 중 오류가 발생했습니다.')
    }
  }

  async function deleteAdminRecommendation(id: string) {
    try {
      const res = await fetch(`/api/jd/recommendations/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        error(`❌ ${data.error || '삭제 실패'}`)
        return
      }

      success('✅ 삭제되었습니다.')

      // 목록에서 제거 (UI 즉시 반영)
      setAdminRecommendations(prev => prev.filter(r => r.id !== id))

    } catch (err) {
      console.error('[deleteAdminRecommendation] Error:', err)
      error('❌ 삭제 중 오류가 발생했습니다.')
    }
  }

  async function respondToRecommendation(id: string, action: 'accept' | 'reject') {
    if (responding) return

    setResponding(true)

    try {
      const res = await fetch(`/api/jd/recommendations/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, pm_comment: commentText.trim() || null })
      })

      if (!res.ok) {
        let errorMessage = '처리 실패'
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch (parseError) {
          console.error('[recommendations] Failed to parse error response:', parseError)
          errorMessage = `서버 오류 (${res.status})`
        }
        error(`❌ ${errorMessage}`)
        return
      }

      const data = await res.json()
      success(data.message || '✅ 처리되었습니다.')
      setSelected(null)
      setCommentText('')

      // 상태 업데이트 (삭제하지 않고 유지)
      setRecommendations(prev => prev.map(r =>
        r.id === id
          ? {
              ...r,
              status: action === 'accept' ? 'accepted' : 'rejected',
              responded_at: new Date().toISOString(),
              pm_comment: commentText.trim() || null
            }
          : r
      ))

    } catch (err) {
      console.error('[recommendations] Respond error:', err)
      error('❌ 처리 중 오류가 발생했습니다.')
    } finally {
      setResponding(false)
    }
  }

  // === 후보자 추천 관리 함수들 ===
  async function loadActiveJDs() {
    setJdLoading(true)
    try {
      const profile = await getProfile()
      if (!profile) return

      // role과 user_email을 파라미터로 전달하여 권한별 필터링
      // only_interests=true: 관심 등록한 JD 중 활성인 것만 표시
      const params = new URLSearchParams({
        status: '활성',
        role: profile.role,
        user_email: profile.email,
        only_interests: 'true'
      })

      const res = await fetch(`/api/jd?${params}`)
      const data = await res.json()

      if (res.ok) {
        setActiveJDs(data.jds || [])
      }
    } catch (err) {
      console.error('[recommendations] Load JDs error:', err)
    } finally {
      setJdLoading(false)
    }
  }

  async function findRecommendedCandidates(jdId: string) {
    if (recommendingJdId) return

    const minScore = minScores[jdId] || 70

    setRecommendingJdId(jdId)
    info(`🤖 AI가 ${minScore}점 이상의 후보자를 찾고 있습니다...`)

    try {
      const res = await fetch(`/api/jd/${jdId}/recommend-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_score: minScore })
      })

      const data = await res.json()

      if (!res.ok) {
        error(`❌ ${data.error || '추천 실패'}`)
        return
      }

      success(`✅ ${data.total}명의 추천 후보를 찾았습니다! (${minScore}점 이상)`)
      loadAdminRecommendations()

    } catch (err) {
      console.error('[findRecommendedCandidates] Error:', err)
      error('❌ 추천 중 오류가 발생했습니다.')
    } finally {
      setRecommendingJdId(null)
    }
  }

  async function loadAdminRecommendations() {
    setAdminLoading(true)
    try {
      let url = '/api/jd/recommendations'

      if (statusFilter === 'pending') {
        url += '?status=pending'
      }
      // statusFilter === 'recommended' 또는 'all'이면 파라미터 없이 전체 가져오기

      const res = await fetch(url)
      const data = await res.json()

      if (res.ok) {
        let recommendations = data.recommendations || []

        // 프론트엔드 필터링
        if (statusFilter === 'recommended') {
          // "전송완료" 탭: recommended, accepted, rejected만 표시
          recommendations = recommendations.filter((r: any) =>
            ['recommended', 'accepted', 'rejected'].includes(r.status)
          )
        }

        setAdminRecommendations(recommendations)
      }
    } catch (err) {
      console.error('[admin recommendations] Load error:', err)
    } finally {
      setAdminLoading(false)
    }
  }

  // === LinkedIn 검색 함수 (Google Custom Search API - 유료) ===
  async function searchLinkedIn() {
    if (!selectedJdForLinkedin) {
      error('JD를 선택해주세요')
      return
    }

    setLinkedinSearching(true)
    setLinkedinResults([])
    setLinkedinKeywords(null)

    try {
      const res = await fetch('/api/linkedin-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jdId: selectedJdForLinkedin
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '검색 실패')
      }

      setLinkedinResults(data.results || [])
      setLinkedinKeywords(data.keywords || null)

      if (data.results && data.results.length > 0) {
        success(`✅ ${data.results.length}개의 LinkedIn 프로필을 찾았습니다! (Google 검색)`)
      } else {
        info('검색 결과가 없습니다. 다른 JD를 선택해보세요.')
      }
    } catch (err: any) {
      error(`❌ Google 검색 실패: ${err.message || '검색 중 오류가 발생했습니다'}`)
    } finally {
      setLinkedinSearching(false)
    }
  }

  // === LinkedIn 무료 검색 함수 (LinkedIn 직접 검색 - API 불필요) ===
  async function searchLinkedInFree() {
    if (!selectedJdForLinkedin) {
      error('JD를 선택해주세요')
      return
    }

    setLinkedinSearching(true)
    setLinkedinResults([])
    setLinkedinKeywords(null)
    setLinkedinSearchUrls([])

    try {
      const res = await fetch('/api/linkedin-search-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jdId: selectedJdForLinkedin
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '검색 실패')
      }

      setLinkedinSearchUrls(data.searchUrls || [])
      setLinkedinKeywords(data.keywords || null)

      if (data.searchUrls && data.searchUrls.length > 0) {
        success(`✅ ${data.searchUrls.length}개의 검색 옵션을 생성했습니다! 클릭해서 LinkedIn에서 검색하세요.`)
      } else {
        info('검색 옵션을 생성할 수 없습니다.')
      }
    } catch (err: any) {
      error(`❌ 검색 URL 생성 실패: ${err.message || '오류가 발생했습니다'}`)
    } finally {
      setLinkedinSearching(false)
    }
  }

  async function sendToPM(id: string) {
    if (sending) return

    setSending(true)

    try {
      const res = await fetch(`/api/jd/recommendations/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_comment: adminCommentText.trim() || null,
          current_salary: editedCurrentSalary.trim() || null,
          desired_salary: editedDesiredSalary.trim() || null,
          education: editedEducation.trim() || null,
          career_summary: editedCareerSummary.trim() || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        error(`❌ ${data.error || '전송 실패'}`)
        return
      }

      success('✅ PM에게 추천을 전송했습니다!')
      setAdminSelected(null)
      setAdminCommentText('')

      // 전송 후 전체 보기로 전환 (목록에서 사라지지 않도록)
      if (statusFilter === 'pending') {
        setStatusFilter('all')
      } else {
        loadAdminRecommendations()
      }

    } catch (err) {
      console.error('[admin recommendations] Send error:', err)
      error('❌ 전송 중 오류가 발생했습니다.')
    } finally {
      setSending(false)
    }
  }

  // JD별로 그룹핑
  const groupedByJd = adminRecommendations.reduce((acc, rec) => {
    const jdId = rec.job_descriptions.id
    if (!acc[jdId]) {
      acc[jdId] = {
        jd: rec.job_descriptions,
        recommendations: []
      }
    }
    acc[jdId].recommendations.push(rec)
    return acc
  }, {} as Record<string, { jd: any, recommendations: Recommendation[] }>)

  return (
    <main className="page">
      <ToastContainer toasts={toasts} onRemove={onRemove} />

      <div className="page-header">
        <div>
          <div className="page-title">Searching</div>
          <div className="page-sub">
            {userRole === 'admin'
              ? 'AI 후보 추천 관리 및 내가 받은 추천을 확인하세요'
              : (userRole === 'owner' || userRole === 'headhunter')
              ? 'Searching 및 내가 받은 추천을 확인하세요'
              : '추천 받은 후보자를 확인하고 수락/거절하세요'}
          </div>
        </div>
      </div>

      {/* 탭 (Admin, Owner, Headhunter) */}
      {(userRole === 'admin' || userRole === 'owner' || userRole === 'headhunter') && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button
            className={`btn${activeTab === 'manage' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setActiveTab('manage')}
          >
            Searching(Database)
          </button>
          <button
            className={`btn${activeTab === 'linkedin' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setActiveTab('linkedin')}
          >
            Searching(Linkedin)
          </button>
          <button
            className={`btn${activeTab === 'received' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setActiveTab('received')}
          >
            내가 받은 추천
          </button>
        </div>
      )}

      {/* 내가 받은 추천 설명 */}
      {activeTab === 'received' && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(232, 255, 71, 0.1)',
          borderRadius: 8,
          marginBottom: 20,
          border: '1px solid rgba(232, 255, 71, 0.2)'
        }}>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            💡 JD를 등록하시면 자사 헤드헌터가 적합한 후보자를 추천해드립니다.
          </div>
        </div>
      )}

      {/* 후보자 추천 관리 탭 */}
      {activeTab === 'manage' && (userRole === 'admin' || userRole === 'owner' || userRole === 'headhunter') ? (
        <>
          {/* 활성 JD 목록 */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-title">활성 JD 목록</div>
            <div className="card-sub">PM이 활성화한 JD에 대해 후보 찾기를 실행하세요</div>

            {jdLoading ? (
              <div className="empty">
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
              </div>
            ) : activeJDs.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📋</div>
                <div className="empty-text">활성 JD가 없습니다</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {activeJDs.map(jd => (
                  <div
                    key={jd.id}
                    style={{
                      padding: 16,
                      background: 'var(--surface-secondary)',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                        {jd.company} - {jd.position}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        🏢 {jd.organizations.name} · 📝 {jd.created_by}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        className="form-select"
                        value={minScores[jd.id] || 70}
                        onChange={(e) => setMinScores({ ...minScores, [jd.id]: Number(e.target.value) })}
                        disabled={recommendingJdId === jd.id}
                        style={{ fontSize: 13, padding: '6px 8px', minWidth: 120 }}
                      >
                        <option value={60}>60점 이상</option>
                        <option value={70}>70점 이상</option>
                        <option value={75}>75점 이상</option>
                        <option value={80}>80점 이상</option>
                        <option value={85}>85점 이상</option>
                        <option value={90}>90점 이상</option>
                      </select>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => findRecommendedCandidates(jd.id)}
                        disabled={recommendingJdId === jd.id}
                        style={{ minWidth: 140 }}
                      >
                        {recommendingJdId === jd.id ? (
                          <>
                            <div className="spinner" style={{ width: 14, height: 14 }} />
                            AI 분석 중...
                          </>
                        ) : (
                          '후보찾기'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 추천 결과 목록 */}
          <div className="card">
            <div className="card-title">AI 추천 결과</div>
            <div className="card-sub">찾은 후보자를 검토하고 PM에게 전송하세요</div>

            {/* 상태 필터 */}
            <div className="filter-bar" style={{ marginBottom: 20, marginTop: 16 }}>
              <button
                className={`filter-btn${statusFilter === 'pending' ? ' active' : ''}`}
                onClick={() => setStatusFilter('pending')}
              >
                대기중 {statusFilter === 'pending' && `(${adminRecommendations.length})`}
              </button>
              <button
                className={`filter-btn${statusFilter === 'recommended' ? ' active' : ''}`}
                onClick={() => setStatusFilter('recommended')}
              >
                전송완료
              </button>
              <button
                className={`filter-btn${statusFilter === 'all' ? ' active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                전체
              </button>
            </div>

            {adminLoading ? (
              <div className="empty">
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
              </div>
            ) : Object.keys(groupedByJd).length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📋</div>
                <div className="empty-text">추천 대기중인 후보자가 없습니다</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {Object.entries(groupedByJd).map(([jdId, group]) => (
                  <div key={jdId} style={{ padding: 16, background: 'var(--surface-secondary)', borderRadius: 8 }}>
                    <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                        {group.jd.company} - {group.jd.position}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        PM: {group.jd.created_by}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                      {group.recommendations
                        .sort((a, b) => b.match_score - a.match_score)
                        .map(rec => (
                          <div
                            key={rec.id}
                            style={{
                              padding: 12,
                              background: rec.status === 'recommended'
                                ? 'rgba(232, 255, 71, 0.05)'
                                : 'var(--surface-secondary)',
                              border: rec.status === 'recommended'
                                ? '1px solid rgba(232, 255, 71, 0.3)'
                                : '1px solid transparent',
                              borderRadius: 8,
                              transition: 'all 0.2s',
                              position: 'relative'
                            }}
                          >
                            {rec.status === 'recommended' && (
                              <div style={{
                                position: 'absolute',
                                top: -8,
                                left: 12,
                                background: 'var(--accent)',
                                color: 'var(--bg)',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4
                              }}>
                                ✓ PM 전송됨
                              </div>
                            )}

                            {/* 전송완료 상태 삭제 버튼 */}
                            {['recommended', 'accepted', 'rejected'].includes(rec.status) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (confirm('이 추천을 삭제하시겠습니까?')) {
                                    deleteAdminRecommendation(rec.id)
                                  }
                                }}
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  background: 'var(--surface-tertiary)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 4,
                                  width: 24,
                                  height: 24,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  color: 'var(--muted)',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--danger)'
                                  e.currentTarget.style.color = 'white'
                                  e.currentTarget.style.borderColor = 'var(--danger)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'var(--surface-tertiary)'
                                  e.currentTarget.style.color = 'var(--muted)'
                                  e.currentTarget.style.borderColor = 'var(--border)'
                                }}
                              >
                                ✕
                              </button>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div
                                style={{ flex: 1, cursor: 'pointer' }}
                                onClick={() => {
                                  setAdminSelected(rec)
                                  setEditedCurrentSalary(rec.candidates.metadata?.current_salary || '')
                                  setEditedDesiredSalary(rec.candidates.desired_salary || '')
                                  setEditedEducation(rec.candidates.education?.join(', ') || '')
                                  setEditedCareerSummary(rec.candidates.career_summary || '')
                                }}
                              >
                                <div style={{
                                  fontSize: 14,
                                  fontWeight: 600,
                                  marginBottom: 4,
                                  opacity: rec.status === 'recommended' ? 0.7 : 1
                                }}>
                                  {rec.candidates.name}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {rec.candidates.current_position || '포지션 미상'}
                                  {rec.candidates.total_experience_years && ` · ${rec.candidates.total_experience_years}년차`}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {/* 출처 뱃지 */}
                                {rec.candidates.source && (
                                  <span
                                    className={`badge ${
                                      rec.candidates.source === 'B2C' ? 'badge-활성' :
                                      rec.candidates.source === 'Local' ? 'badge-일반' :
                                      'badge-일반'
                                    }`}
                                    style={{
                                      background:
                                        rec.candidates.source === 'B2C' ? '#3b82f6' :
                                        rec.candidates.source === 'Local' ? '#10b981' :
                                        rec.candidates.source === 'B2B' ? '#8b5cf6' :
                                        'var(--muted)',
                                      color: 'white',
                                      fontSize: 10
                                    }}
                                  >
                                    {rec.candidates.source === 'B2C' ? '🔵 B2C' :
                                     rec.candidates.source === 'Local' ? '🟢 Local' :
                                     rec.candidates.source === 'B2B' ? '🟣 B2B' :
                                     rec.candidates.source}
                                  </span>
                                )}
                                <span className="badge badge-일반">매칭 {rec.match_score}점</span>
                                <span className={`badge badge-${rec.recommendation === '추천' ? '활성' : '일반'}`}>
                                  {rec.recommendation}
                                </span>
                                {rec.status === 'pending' && (
                                  <button
                                    className="btn btn-success btn-sm"
                                    onClick={() => {
                                      setAdminSelected(rec)
                                      setEditedCurrentSalary(rec.candidates.metadata?.current_salary || '')
                                      setEditedDesiredSalary(rec.candidates.desired_salary || '')
                                      setEditedEducation(rec.candidates.education?.join(', ') || '')
                                      setEditedCareerSummary(rec.candidates.career_summary || '')
                                    }}
                                  >
                                    PM에게 전송
                                  </button>
                                )}
                                {rec.status === 'recommended' && (
                                  <span className="badge badge-활성">✓ 전송완료</span>
                                )}
                                {rec.status === 'accepted' && (
                                  <span className="badge badge-활성">✅ 수락됨</span>
                                )}
                                {rec.status === 'rejected' && (
                                  <span className="badge badge-일반">❌ 거절됨</span>
                                )}
                              </div>

                              {/* 거절 사유 표시 */}
                              {rec.status === 'rejected' && rec.pm_comment && (
                                <div style={{
                                  marginTop: 8,
                                  padding: 8,
                                  background: 'rgba(255, 59, 48, 0.1)',
                                  border: '1px solid rgba(255, 59, 48, 0.3)',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  color: 'var(--muted)'
                                }}>
                                  <div style={{ fontWeight: 600, marginBottom: 4 }}>거절 사유:</div>
                                  {rec.pm_comment}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 관리자 상세 모달 */}
          {adminSelected && (
            <div className="modal-overlay" onClick={() => setAdminSelected(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                <div className="modal-header">
                  <div className="modal-title">추천 후보자 상세</div>
                  <button className="modal-close" onClick={() => setAdminSelected(null)}>✕</button>
                </div>

                <div style={{ padding: 24 }}>
                  {/* JD & 후보자 정보 */}
                  <div style={{ marginBottom: 20, padding: 16, background: 'var(--surface-secondary)', borderRadius: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                      {adminSelected.job_descriptions.company} - {adminSelected.job_descriptions.position}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>
                        👨‍💼 {adminSelected.candidates.name} ({adminSelected.candidates.current_position || '포지션 미상'})
                        {adminSelected.candidates.total_experience_years && ` · 경력 ${adminSelected.candidates.total_experience_years}년`}
                      </span>
                      {/* 출처 뱃지 */}
                      {adminSelected.candidates.source && (
                        <span
                          className="badge"
                          style={{
                            background:
                              adminSelected.candidates.source === 'B2C' ? '#3b82f6' :
                              adminSelected.candidates.source === 'Local' ? '#10b981' :
                              adminSelected.candidates.source === 'B2B' ? '#8b5cf6' :
                              'var(--muted)',
                            color: 'white',
                            fontSize: 10
                          }}
                        >
                          {adminSelected.candidates.source === 'B2C' ? '🔵 B2C' :
                           adminSelected.candidates.source === 'Local' ? '🟢 Local' :
                           adminSelected.candidates.source === 'B2B' ? '🟣 B2B' :
                           adminSelected.candidates.source}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                      PM: {adminSelected.recommended_to}
                    </div>
                  </div>

                  {/* 후보자 상세 정보 (수정 가능) */}
                  <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface-secondary)', borderRadius: 6 }}>
                    <div className="form-label" style={{ marginBottom: 8 }}>📋 후보자 상세</div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        🎓 학력 (대학교, 대학원, 박사 등 쉼표로 구분)
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="예: 서울대 컴퓨터공학 학사, KAIST 대학원 석사"
                        value={editedEducation}
                        onChange={e => setEditedEducation(e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        💼 회사 정보
                      </label>
                      <textarea
                        className="form-textarea"
                        placeholder="예: A사 3년 (백엔드 개발) -> B사 4년 (팀장) -> C사 3년 (시니어 개발자)"
                        value={editedCareerSummary}
                        onChange={e => setEditedCareerSummary(e.target.value)}
                        style={{ fontSize: 13, minHeight: 80 }}
                      />
                    </div>
                  </div>

                  {/* 매칭 점수 */}
                  <div style={{ marginBottom: 16 }}>
                    <div className="form-label">매칭 점수</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span className="badge badge-일반" style={{ fontSize: 14 }}>
                        종합 {adminSelected.match_score}점
                      </span>
                      <span className="badge badge-일반" style={{ fontSize: 14 }}>
                        스킬 {adminSelected.skill_match_rate}점
                      </span>
                      <span className={`badge badge-${adminSelected.recommendation === '추천' ? '활성' : '일반'}`} style={{ fontSize: 14 }}>
                        {adminSelected.recommendation}
                      </span>
                    </div>
                  </div>

                  {/* 추천 사유 */}
                  <div style={{ marginBottom: 16 }}>
                    <div className="form-label">추천 사유</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{adminSelected.match_reason}</div>
                  </div>

                  {/* 강점 */}
                  {adminSelected.strength_for_jd?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div className="form-label">JD 매칭 강점</div>
                      <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {adminSelected.strength_for_jd.map((s, i) => (
                          <li key={i} style={{ fontSize: 13, color: 'var(--success)' }}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}


                  {/* 다음 단계 */}
                  <div style={{ marginBottom: 16 }}>
                    <div className="form-label">다음 단계</div>
                    <div style={{ fontSize: 13 }}>{adminSelected.next_steps}</div>
                  </div>

                  {/* 경력 매칭 */}
                  {adminSelected.experience_match && (
                    <div style={{ marginBottom: 16 }}>
                      <div className="form-label">경력 적합도</div>
                      <div style={{ fontSize: 13 }}>{adminSelected.experience_match}</div>
                    </div>
                  )}

                  {adminSelected.status === 'pending' && (
                    <>
                      {/* 연봉 정보 */}
                      <div style={{ marginBottom: 20, padding: 12, background: 'var(--surface-secondary)', borderRadius: 6 }}>
                        <div className="form-label" style={{ marginBottom: 8 }}>💰 연봉 정보</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                              직전연봉
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="예: 8,000만원"
                              value={editedCurrentSalary}
                              onChange={e => setEditedCurrentSalary(e.target.value)}
                              style={{ fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                              희망연봉
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="예: 9,000만원"
                              value={editedDesiredSalary}
                              onChange={e => setEditedDesiredSalary(e.target.value)}
                              style={{ fontSize: 13 }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 관리자 코멘트 입력 */}
                      <div style={{ marginBottom: 20 }}>
                        <div className="form-label">PM에게 전달할 코멘트 (선택)</div>
                        <textarea
                          className="form-textarea"
                          placeholder="추가 코멘트가 있으면 입력하세요"
                          value={adminCommentText}
                          onChange={e => setAdminCommentText(e.target.value)}
                          style={{ minHeight: 80 }}
                        />
                      </div>

                      {/* 전송 버튼 */}
                      <button
                        className="btn btn-primary"
                        onClick={() => sendToPM(adminSelected.id)}
                        disabled={sending}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        {sending ? '전송 중...' : '📤 PM에게 추천 전송'}
                      </button>
                    </>
                  )}

                  {adminSelected.status === 'recommended' && (
                    <div style={{ padding: 12, background: 'var(--surface-secondary)', borderRadius: 6, textAlign: 'center' }}>
                      ✅ PM에게 전송 완료 ({new Date(adminSelected.recommended_at!).toLocaleDateString('ko-KR')})
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'linkedin' ? (
        <div className="card">
          <div className="card-title">Searching(Linkedin)</div>

          {/* 검색 폼 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">검색할 JD 선택</label>
                <select
                  className="form-select"
                  value={selectedJdForLinkedin}
                  onChange={e => setSelectedJdForLinkedin(e.target.value)}
                  disabled={linkedinSearching}
                >
                  <option value="">JD를 선택하세요</option>
                  {activeJDs.map(jd => (
                    <option key={jd.id} value={jd.id}>
                      {jd.position} ({jd.company})
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary"
                onClick={searchLinkedIn}
                disabled={true}
                style={{ minWidth: 120, opacity: 0.5, cursor: 'not-allowed' }}
                title="Google API 설정 필요 (현재 비활성화)"
              >
                🔍 유료 검색
              </button>
              <button
                className="btn btn-success"
                onClick={searchLinkedInFree}
                disabled={linkedinSearching || !selectedJdForLinkedin}
                style={{ minWidth: 120 }}
              >
                {linkedinSearching ? '검색 중...' : '✨ 무료 검색'}
              </button>
            </div>

            {/* 유료 검색 비활성화 안내 */}
            <div style={{
              marginTop: 8,
              padding: 8,
              background: 'var(--bg)',
              borderRadius: 4,
              fontSize: 11,
              color: 'var(--muted2)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6
            }}>
              <span>ℹ️</span>
              <span>
                유료 검색(Google API)은 현재 비활성화되어 있습니다. 무료 검색을 사용하세요!
              </span>
            </div>

            {/* 추출된 키워드 표시 */}
            {linkedinKeywords && (
              <div style={{
                marginTop: 12,
                padding: 12,
                background: 'var(--bg)',
                borderRadius: 6,
                fontSize: 12
              }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>검색 키워드:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="badge badge-활성">
                    핵심: {linkedinKeywords.coreJob}
                  </span>
                  {linkedinKeywords.qualifiers?.map((q: string, i: number) => (
                    <span key={`qualifier-${i}-${q}`} className="badge">
                      {q}
                    </span>
                  ))}
                  {linkedinKeywords.skills?.map((s: string, i: number) => (
                    <span key={`skill-${i}-${s}`} className="badge badge-일반">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 로딩 상태 */}
          {linkedinSearching && (
            <div className="empty">
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
                검색 옵션을 생성하고 있습니다...
              </div>
            </div>
          )}

          {/* 무료 검색: LinkedIn 검색 URL 목록 */}
          {!linkedinSearching && linkedinSearchUrls.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span>🔗 LinkedIn에서 검색하기</span>
                <span style={{ fontSize: 11, color: 'var(--muted2)', fontWeight: 400 }}>
                  (클릭하면 LinkedIn이 새 탭에서 열립니다)
                </span>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {linkedinSearchUrls.map((searchUrl, index) => (
                  <div
                    key={`search-url-${index}-${searchUrl.label}`}
                    className="card"
                    style={{
                      padding: 14,
                      background: 'var(--bg)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: '1px solid var(--border)'
                    }}
                    onClick={() => window.open(searchUrl.url, '_blank')}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 600,
                          marginBottom: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          {index === 0 && <span className="badge badge-활성" style={{ fontSize: 10 }}>추천</span>}
                          {searchUrl.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
                          {searchUrl.description}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 20,
                        color: 'var(--accent)',
                        flexShrink: 0
                      }}>
                        →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 12,
                padding: 12,
                background: 'var(--bg)',
                borderRadius: 6,
                fontSize: 11,
                color: 'var(--muted2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8
              }}>
                <span>💡</span>
                <span>
                  LinkedIn 로그인이 필요합니다. 여러 검색 옵션을 시도해서 최적의 후보자를 찾아보세요!
                </span>
              </div>
            </div>
          )}

          {/* 유료 검색 결과 (Google API) */}
          {!linkedinSearching && linkedinResults.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              {linkedinResults.map((result, index) => (
                <div
                  key={index}
                  className="card"
                  style={{
                    padding: 16,
                    background: 'var(--bg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => window.open(result.url, '_blank')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                        {result.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 8 }}>
                        {result.snippet}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        🔗 {result.url}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(result.url, '_blank')
                      }}
                      style={{ flexShrink: 0 }}
                    >
                      프로필 보기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 빈 상태 */}
          {!linkedinSearching && linkedinResults.length === 0 && linkedinSearchUrls.length === 0 && linkedinKeywords && (
            <div className="empty">
              <div className="empty-icon">🔍</div>
              <div className="empty-text">검색 옵션을 생성할 수 없습니다</div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
                다른 JD를 선택하거나 JD의 직무명을 더 명확하게 수정해보세요
              </div>
            </div>
          )}

          {/* 초기 상태 */}
          {!linkedinSearching && linkedinResults.length === 0 && !linkedinKeywords && (
            <div className="empty">
              <div className="empty-icon">🔗</div>
              <div className="empty-text">JD를 선택하고 검색을 시작하세요</div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
                Google을 통해 LinkedIn 프로필을 검색합니다
              </div>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="empty">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
        </div>
      ) : recommendations.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <div className="empty-text">받은 추천이 없습니다</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {recommendations.map(rec => (
            <div
              key={rec.id}
              className="card"
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: rec.status !== 'recommended' ? 0.7 : 1,
                position: 'relative'
              }}
              onClick={() => setSelected(rec)}
            >
              {/* X 삭제 버튼 */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteRecommendation(rec.id)
                }}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'var(--surface-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--danger)'
                  e.currentTarget.style.color = 'white'
                  e.currentTarget.style.borderColor = 'var(--danger)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-secondary)'
                  e.currentTarget.style.color = 'var(--text-tertiary)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
                title="삭제"
              >
                ✕
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingRight: 30 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                    {rec.job_descriptions.company} - {rec.job_descriptions.position}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    👨‍💼 {rec.candidates.name} ({rec.candidates.current_position || '포지션 미상'})
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {/* 출처 뱃지 */}
                  {rec.candidates.source && (
                    <span
                      className="badge"
                      style={{
                        background:
                          rec.candidates.source === 'B2C' ? '#3b82f6' :
                          rec.candidates.source === 'Local' ? '#10b981' :
                          rec.candidates.source === 'B2B' ? '#8b5cf6' :
                          'var(--muted)',
                        color: 'white',
                        fontSize: 10
                      }}
                    >
                      {rec.candidates.source === 'B2C' ? '🔵 B2C' :
                       rec.candidates.source === 'Local' ? '🟢 Local' :
                       rec.candidates.source === 'B2B' ? '🟣 B2B' :
                       rec.candidates.source}
                    </span>
                  )}
                  <span className="badge badge-활성">매칭 {rec.match_score}점</span>
                  {rec.status === 'accepted' && (
                    <span className="badge badge-활성" style={{ fontSize: 11 }}>✅ 수락됨</span>
                  )}
                  {rec.status === 'rejected' && (
                    <span className="badge badge-일반" style={{ fontSize: 11 }}>❌ 거절됨</span>
                  )}
                </div>
              </div>

              <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                {rec.match_reason}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {new Date(rec.recommended_at!).toLocaleDateString('ko-KR')} 추천됨
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PM 상세 모달 */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div className="modal-title">추천 후보자 상세</div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* JD & 후보자 정보 */}
              <div style={{ marginBottom: 20, padding: 16, background: 'var(--surface-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                  {selected.job_descriptions.company} - {selected.job_descriptions.position}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>
                    👨‍💼 {selected.candidates.name} ({selected.candidates.current_position || '포지션 미상'})
                    {selected.candidates.total_experience_years && ` · 경력 ${selected.candidates.total_experience_years}년`}
                  </span>
                  {/* 출처 뱃지 */}
                  {selected.candidates.source && (
                    <span
                      className="badge"
                      style={{
                        background:
                          selected.candidates.source === 'B2C' ? '#3b82f6' :
                          selected.candidates.source === 'Local' ? '#10b981' :
                          selected.candidates.source === 'B2B' ? '#8b5cf6' :
                          'var(--muted)',
                        color: 'white',
                        fontSize: 10
                      }}
                    >
                      {selected.candidates.source === 'B2C' ? '🔵 B2C' :
                       selected.candidates.source === 'Local' ? '🟢 Local' :
                       selected.candidates.source === 'B2B' ? '🟣 B2B' :
                       selected.candidates.source}
                    </span>
                  )}
                </div>

                {/* 학력 */}
                {selected.candidates.education && selected.candidates.education.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>🎓 학력</div>
                    {selected.candidates.education.map((edu, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 16 }}>
                        • {edu}
                      </div>
                    ))}
                  </div>
                )}

                {/* 회사 정보 */}
                {selected.candidates.career_summary && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>💼 회사 정보</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 16, whiteSpace: 'pre-wrap' }}>
                      {selected.candidates.career_summary}
                    </div>
                  </div>
                )}
                {/* 연봉 정보 */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>💰 연봉 정보</div>
                  <div style={{ fontSize: 13, display: 'flex', gap: 16, paddingLeft: 16 }}>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>직전: </span>
                      <span style={{ fontWeight: 500 }}>
                        {selected.candidates.metadata?.current_salary || '미입력'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>희망: </span>
                      <span style={{ fontWeight: 500 }}>
                        {selected.candidates.desired_salary || '미입력'}
                      </span>
                    </div>
                  </div>
                </div>
                {selected.recommended_by && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                    추천자: {selected.recommended_by}
                  </div>
                )}
              </div>

              {/* 점수 */}
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">점수</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span className="badge badge-일반" style={{ fontSize: 14 }}>
                    종합 {selected.match_score}점
                  </span>
                  <span className="badge badge-일반" style={{ fontSize: 14 }}>
                    스킬 {selected.skill_match_rate}점
                  </span>
                </div>
              </div>

              {/* 추천 사유 */}
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">추천 사유</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{selected.match_reason}</div>
              </div>

              {/* 강점 */}
              {selected.strength_for_jd?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">JD 매칭 강점</div>
                  <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selected.strength_for_jd.map((s, i) => (
                      <li key={i} style={{ fontSize: 13, color: 'var(--success)' }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 관리자 코멘트 */}
              {selected.admin_comment && (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">관리자 코멘트</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, padding: 12, background: 'var(--surface-secondary)', borderRadius: 6 }}>
                    {selected.admin_comment}
                  </div>
                </div>
              )}

              {selected.status === 'recommended' && (
                <>
                  {/* PM 코멘트 입력 */}
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label">의견 (선택)</div>
                    <textarea
                      className="form-textarea"
                      placeholder="수락/거절 사유를 입력하세요"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      style={{ minHeight: 80 }}
                    />
                  </div>

                  {/* 수락/거절 버튼 */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      className="btn btn-success"
                      onClick={() => respondToRecommendation(selected.id, 'accept')}
                      disabled={responding}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      {responding ? '처리 중...' : '✅ 수락 (파이프라인에 추가)'}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => respondToRecommendation(selected.id, 'reject')}
                      disabled={responding}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      {responding ? '처리 중...' : '❌ 거절'}
                    </button>
                  </div>
                </>
              )}

              {(selected.status === 'accepted' || selected.status === 'rejected') && (
                <div style={{ padding: 12, background: 'var(--surface-secondary)', borderRadius: 6, textAlign: 'center' }}>
                  {selected.status === 'accepted' ? '✅ 수락됨' : '❌ 거절됨'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

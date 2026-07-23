'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getProfile } from '@/lib/auth'
import { downloadCandidatesAsCSV } from '@/lib/csv-export'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ToastContainer'

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
  birth_year: number | null
  location: string | null
  source?: string | null
  current_company: string | null
  current_position: string | null
  total_experience_years: number | null
  career_summary: string
  education: string[]
  skills: string[]
  tech_stack: string[]
  ideal_roles: string[]
  market_value: string
  strength_summary: string
  weakness_summary: string
  career_trajectory: string
  key_highlights: string[]
  tags: string[]
  status: string
  job_search_status: string
  created_at: string
  created_by?: string
  created_by_user?: {
    id: string
    full_name: string | null
    email: string
  }
  pipeline?: PipelineInfo[]
  organization?: {
    id: string
    name: string
  }
  metadata?: {
    job_request?: {
      position?: string
      message?: string
      requested_at?: string
      has_active_request?: boolean
    }
    adam_analysis_data?: any
  }
}

const STATUS_FILTERS = ['전체', '검토중', '활성', '제안중', '합격', '보류']

interface Organization {
  id: string
  name: string
}

interface User {
  id: string
  email: string
  full_name: string | null
  role: string
}

// 최종학력 추출 함수 (전체 텍스트 반환)
function getFinalEducation(education: string[] | undefined): string {
  if (!education || education.length === 0) return ''

  // 학력 우선순위로 가장 높은 학력 찾기
  const priorities = [
    ['박사', 'Ph.D', 'PhD', 'Doctor'],
    ['석사', 'Master', '대학원'],
    ['학사', '대학교', '대졸', 'Bachelor', '4년제'],
    ['전문학사', '전문대', '2년제'],
    ['고등학교', '고졸'],
  ]

  // 우선순위대로 검색해서 가장 높은 학력 반환
  for (const keywords of priorities) {
    const found = education.find(edu =>
      keywords.some(keyword => edu.includes(keyword))
    )
    if (found) return found
  }

  // 우선순위에 없으면 첫 번째 항목 반환
  return education[0]
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [skillSearch, setSkillSearch] = useState('')
  const [minExperience, setMinExperience] = useState('')
  const [maxExperience, setMaxExperience] = useState('')
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [userOrgId, setUserOrgId] = useState<string>('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('전체')
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [orgMembers, setOrgMembers] = useState<User[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [reanalyzing, setReanalyzing] = useState<string | null>(null)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [editForm, setEditForm] = useState<Partial<Candidate>>({})
  const [comments, setComments] = useState<any[]>([])
  const [commentContent, setCommentContent] = useState('')
  const [showCommentForm, setShowCommentForm] = useState(false)
  const [processingJobId, setProcessingJobId] = useState<string | null>(null)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStep, setProcessingStep] = useState(0) // 0: 읽기, 1: 분석, 2: 생성, 3: 완료
  const [showJdRecommendModal, setShowJdRecommendModal] = useState(false)
  const [jds, setJds] = useState<any[]>([])
  const [jdsLoading, setJdsLoading] = useState(false)
  const [matchingJdId, setMatchingJdId] = useState<string | null>(null)
  const [jdMatches, setJdMatches] = useState<Record<string, any>>({})

  const { toasts, success, error, info, removeToast } = useToast()

  // 백그라운드 처리 중인 job 확인
  useEffect(() => {
    const jobId = localStorage.getItem('processing_job_id')
    const jobType = localStorage.getItem('processing_job_type')

    if (jobId && jobType === 'candidate') {
      setProcessingJobId(jobId)
      setProcessingStep(0)

      // 단계별 자동 진행 (시각적 피드백)
      const stepInterval = setInterval(() => {
        setProcessingStep(prev => {
          if (prev < 2) return prev + 1 // 최대 2단계까지만 자동 진행
          return prev
        })
      }, 8000) // 8초마다 다음 단계

      // Polling으로 상태 확인
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`)
          const data = await res.json()

          setProcessingProgress(data.progress || 0)

          // 실제 진행 상황에 따라 단계 업데이트
          if (data.progress >= 20 && data.progress < 80) {
            setProcessingStep(1) // 분석 중
          } else if (data.progress >= 80 && data.progress < 100) {
            setProcessingStep(2) // 생성 중
          }

          if (data.status === 'completed') {
            clearInterval(stepInterval)
            clearInterval(pollInterval)
            localStorage.removeItem('processing_job_id')
            localStorage.removeItem('processing_job_type')
            setProcessingJobId(null)

            // ✅ Job result를 candidates 테이블에 저장
            const profile = await getProfile()
            if (profile && data.result) {
              try {
                console.log('[save candidate] Profile:', profile)
                console.log('[save candidate] Job result:', data.result)
                console.log('[save candidate] Job input:', data.input)

                // candidates 테이블에 저장
                const savePayload = {
                  ...data.result,
                  raw_resume: data.input?.resumeText || '', // ✅ 원본 이력서 텍스트
                  organization_id: profile.organization_id,
                  created_by: profile.email,
                  status: '대기'
                }
                console.log('[save candidate] Payload:', savePayload)

                const saveRes = await fetch('/api/candidates', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(savePayload)
                })

                if (!saveRes.ok) {
                  const errorData = await saveRes.json()
                  console.error('[save candidate] Error response:', errorData)
                  throw new Error(`후보자 저장 실패: ${errorData.error || saveRes.statusText}`)
                }

                // 목록 새로고침
                const params = new URLSearchParams({
                  role: profile.role,
                  user_email: profile.email,
                  ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
                  ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
                })
                const refreshRes = await fetch(`/api/candidates?${params}`)
                const refreshData = await refreshRes.json()
                setCandidates(refreshData.candidates ?? [])
                success('✅ 후보자 분석이 완료되었습니다!')
              } catch (err) {
                console.error('[save candidate] Error:', err)
                error('❌ 후보자 저장 실패')
              }
            }
          } else if (data.status === 'failed') {
            clearInterval(pollInterval)
            clearInterval(stepInterval)
            localStorage.removeItem('processing_job_id')
            localStorage.removeItem('processing_job_type')
            setProcessingJobId(null)
            setProcessingStep(0)
            error('❌ 후보자 분석 실패')
          }
        } catch (err) {
          console.error('[poll] Error:', err)
        }
      }, 2000)

      return () => {
        clearInterval(pollInterval)
        clearInterval(stepInterval)
      }
    }
  }, [selectedOrgId])

  useEffect(() => {
    async function loadOrganizations() {
      const profile = await getProfile()
      if (!profile) return

      setIsAdmin(profile.role === 'admin')
      setIsOwner(profile.role === 'owner')
      setUserOrgId(profile.organization_id || '')

      if (profile.role === 'admin') {
        const res = await fetch('/api/admin/organizations')
        const data = await res.json()
        setOrganizations(data.organizations ?? [])
      }

      // Owner인 경우 조직 멤버 로드
      if (profile.role === 'owner' && profile.organization_id) {
        const params = new URLSearchParams({
          role: 'owner',
          organization_id: profile.organization_id,
        })
        const res = await fetch(`/api/admin/users?${params}`)
        const data = await res.json()
        setOrgMembers(data.users ?? [])
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
        user_email: profile.email,
        ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
        ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id }),
        ...(search.trim() && { search: search.trim() })
      })

      fetch(`/api/candidates?${params}`)
        .then(r => r.json())
        .then(d => {
          setCandidates(d.candidates ?? [])
          setTotalCount(d.total ?? 0)
          setStatusCounts(d.statusCounts ?? {})
          setHasMore(d.hasMore ?? false)
        })
        .finally(() => setLoading(false))
    }
    loadCandidates()
  }, [selectedOrgId, search])

  // 모달 열릴 때 코멘트 로드
  useEffect(() => {
    if (selected?.id) {
      loadComments(selected.id)
    }
  }, [selected?.id])

  // JD 추천 모달 열릴 때 JD 목록 로드
  useEffect(() => {
    if (showJdRecommendModal) {
      loadJDs()
    }
  }, [showJdRecommendModal])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/candidates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev)
  }

  async function deleteCandidate(id: string) {
    if (!confirm('이 후보자를 삭제할까요?')) return

    try {
      const res = await fetch(`/api/candidates/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        alert('❌ 삭제 실패: ' + (data.error || '알 수 없는 오류'))
        return
      }

      setCandidates(prev => prev.filter(c => c.id !== id))
      if (selected?.id === id) closeModal()
      alert('✅ 후보자가 삭제되었습니다')
    } catch (error) {
      console.error('삭제 중 오류:', error)
      alert('❌ 삭제 중 오류가 발생했습니다')
    }
  }

  async function reanalyzeCandidate(id: string) {
    if (!confirm('이 후보자를 재분석할까요? (기존 분석 결과가 업데이트됩니다)')) return

    setReanalyzing(id)

    try {
      const res = await fetch(`/api/candidates/${id}/reanalyze`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        alert('❌ ' + (data.error || '재분석 실패'))
        setReanalyzing(null)
        return
      }

      alert('✅ 재분석이 완료되었습니다')

      // 목록 새로고침
      window.location.reload()
    } catch (error) {
      console.error('재분석 중 오류:', error)
      alert('❌ 재분석 중 오류가 발생했습니다')
      setReanalyzing(null)
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)

    try {
      const profile = await getProfile()
      if (!profile) return

      const params = new URLSearchParams({
        role: profile.role,
        user_email: profile.email,
        limit: '50',
        offset: candidates.length.toString(),
        ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
        ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
      })

      const res = await fetch(`/api/candidates?${params}`)
      const data = await res.json()

      setCandidates(prev => [...prev, ...(data.candidates ?? [])])
      setHasMore(data.hasMore ?? false)
    } catch (err) {
      console.error('Failed to load more candidates:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  function closeModal() {
    setSelected(null)
    setIsEditing(false)
    setEditForm({})
    setComments([])
    setCommentContent('')
    setShowCommentForm(false)
  }

  async function updateCandidate() {
    if (!selected) return

    // 수정 가능한 필드만 추출 (undefined 제거)
    const updateData: Partial<Candidate> = {}
    if (editForm.name !== undefined) updateData.name = editForm.name
    if (editForm.email !== undefined) updateData.email = editForm.email
    if (editForm.phone !== undefined) updateData.phone = editForm.phone
    if (editForm.birth_year !== undefined) updateData.birth_year = editForm.birth_year
    if (editForm.location !== undefined) updateData.location = editForm.location
    if (editForm.current_company !== undefined) updateData.current_company = editForm.current_company
    if (editForm.current_position !== undefined) updateData.current_position = editForm.current_position
    if (editForm.total_experience_years !== undefined) updateData.total_experience_years = editForm.total_experience_years
    if (editForm.market_value !== undefined) updateData.market_value = editForm.market_value
    if (editForm.career_summary !== undefined) updateData.career_summary = editForm.career_summary
    if (editForm.strength_summary !== undefined) updateData.strength_summary = editForm.strength_summary
    if (editForm.weakness_summary !== undefined) updateData.weakness_summary = editForm.weakness_summary
    if (editForm.career_trajectory !== undefined) updateData.career_trajectory = editForm.career_trajectory

    const res = await fetch(`/api/candidates/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    })

    if (!res.ok) {
      error('업데이트 실패')
      return
    }

    // 로컬 state 업데이트
    const updated: Candidate = { ...selected, ...updateData }
    setCandidates(prev => prev.map(c => c.id === selected.id ? updated : c))
    setSelected(updated)
    setIsEditing(false)
    setEditForm({})
  }

  async function transferOwnership() {
    if (!selected || !transferTarget) return

    setTransferring(true)
    try {
      const res = await fetch(`/api/candidates/${selected.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_email: transferTarget }),
      })
      const data = await res.json()

      if (!res.ok) {
        error(data.error || '이전 실패')
        return
      }

      success('✅ 소유권이 이전되었습니다!')
      setShowTransferModal(false)
      setTransferTarget('')
      closeModal()

      // 목록 새로고침
      window.location.reload()
    } catch (e: any) {
      error('오류: ' + e.message)
    } finally {
      setTransferring(false)
    }
  }

  // 코멘트 로드
  async function loadComments(candidateId: string) {
    try {
      const profile = await getProfile()
      if (!profile) return

      const res = await fetch(`/api/candidates/${candidateId}/comments`, {
        headers: { 'x-user-email': profile.email }
      })
      const data = await res.json()
      setComments(data.comments || [])
    } catch (e) {
      console.error('[loadComments] Error:', e)
      setComments([])
    }
  }

  // JD 목록 로드
  async function loadJDs() {
    setJdsLoading(true)
    try {
      const profile = await getProfile()
      if (!profile) return

      const params = new URLSearchParams({
        role: profile.role,
        user_email: profile.email
      })

      const res = await fetch(`/api/jd?${params}`)
      const data = await res.json()

      if (res.ok) {
        setJds(data.jds || [])
      }
    } catch (err) {
      console.error('[loadJDs] Error:', err)
    } finally {
      setJdsLoading(false)
    }
  }

  // 후보자-JD 매칭 분석
  async function matchJD(jdId: string) {
    if (!selected) return

    setMatchingJdId(jdId)
    try {
      const jd = jds.find(j => j.id === jdId)
      if (!jd) return

      const res = await fetch('/api/pipeline/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, candidate: selected })
      })

      if (!res.ok) {
        error('❌ 매칭 분석 실패')
        return
      }

      const matchData = await res.json()
      setJdMatches(prev => ({
        ...prev,
        [jdId]: matchData
      }))
    } catch (err) {
      console.error('[matchJD] Error:', err)
      error('❌ 매칭 분석 실패')
    } finally {
      setMatchingJdId(null)
    }
  }

  // 프로세스에 추가
  async function addJDToPipeline(jdId: string) {
    if (!selected) return

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_id: jdId,
          candidate_id: selected.id,
          stage: '검토',
          match_analysis: jdMatches[jdId]
        })
      })

      if (!res.ok) {
        error('❌ 프로세스 추가 실패')
        return
      }

      success('✅ 프로세스에 추가되었습니다!')
      setShowJdRecommendModal(false)
      setJdMatches({})
    } catch (err) {
      console.error('[addJDToPipeline] Error:', err)
      error('❌ 프로세스 추가 실패')
    }
  }

  // 코멘트 작성
  async function createComment() {
    if (!selected || !commentContent.trim()) return

    try {
      const profile = await getProfile()
      if (!profile) return

      const res = await fetch(`/api/candidates/${selected.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email
        },
        body: JSON.stringify({ content: commentContent })
      })

      const data = await res.json()
      if (res.ok) {
        setComments([data.comment, ...comments])
        setCommentContent('')
        setShowCommentForm(false)
        success('✅ 코멘트가 추가되었습니다!')
      } else {
        error(data.error || '작성 실패')
      }
    } catch (e) {
      error('작성 중 오류가 발생했습니다.')
    }
  }

  // 코멘트 삭제
  async function deleteComment(commentId: string) {
    if (!selected) return
    if (!confirm('코멘트를 삭제할까요?')) return

    try {
      const profile = await getProfile()
      if (!profile) return

      const res = await fetch(`/api/candidates/${selected.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'x-user-email': profile.email }
      })

      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId))
        success('✅ 코멘트가 삭제되었습니다!')
      } else {
        const data = await res.json()
        error(data.error || '삭제 실패')
      }
    } catch (e) {
      error('삭제 중 오류가 발생했습니다.')
    }
  }

  // 기본 필터 (상태)
  const filtered = filter === '전체' ? candidates : candidates.filter(c => c.status === filter)

  // 검색은 API에서 처리 (useEffect dependency에 search 추가됨)
  // 고급 필터만 클라이언트에서 처리
  let advanced = filtered

  // 스킬 검색
  if (skillSearch.trim()) {
    advanced = advanced.filter(c => {
      const skills = [...(c.skills || []), ...(c.tech_stack || [])]
      return skills.some(s => s?.toLowerCase().includes(skillSearch.toLowerCase()))
    })
  }

  // 경력 범위
  if (minExperience) {
    advanced = advanced.filter(c => (c.total_experience_years || 0) >= parseInt(minExperience))
  }
  if (maxExperience) {
    advanced = advanced.filter(c => (c.total_experience_years || 0) <= parseInt(maxExperience))
  }

  // 최신 등록 순으로 정렬 (신규 후보자가 맨 위로)
  const finalFiltered = [...advanced].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <main className="page">
      {/* 백그라운드 처리 중 표시 */}
      {processingJobId && (
        <div style={{
          position: 'fixed',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'var(--bg2)',
          border: '2px solid var(--primary)',
          padding: '16px 24px',
          borderRadius: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          minWidth: 320,
          maxWidth: '90%'
        }}>
          {/* 제목 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text)'
          }}>
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            이력서 분석 중...
          </div>

          {/* 단계 표시 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 1단계: 이력서 읽기 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: processingStep >= 0 ? 'var(--text)' : 'var(--muted2)',
              opacity: processingStep >= 0 ? 1 : 0.5
            }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: processingStep > 0 ? 'var(--success)' : processingStep === 0 ? 'var(--primary)' : 'var(--bg3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: processingStep >= 0 ? 'var(--bg)' : 'var(--muted2)',
                flexShrink: 0
              }}>
                {processingStep > 0 ? '✓' : processingStep === 0 && <div className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} />}
              </div>
              <span>📄 이력서 읽는 중...</span>
            </div>

            {/* 2단계: AI 분석 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: processingStep >= 1 ? 'var(--text)' : 'var(--muted2)',
              opacity: processingStep >= 1 ? 1 : 0.5
            }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: processingStep > 1 ? 'var(--success)' : processingStep === 1 ? 'var(--primary)' : 'var(--bg3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: processingStep >= 1 ? 'var(--bg)' : 'var(--muted2)',
                flexShrink: 0
              }}>
                {processingStep > 1 ? '✓' : processingStep === 1 && <div className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} />}
              </div>
              <span>🤖 AI 분석 중...</span>
            </div>

            {/* 3단계: 결과 생성 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: processingStep >= 2 ? 'var(--text)' : 'var(--muted2)',
              opacity: processingStep >= 2 ? 1 : 0.5
            }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: processingStep > 2 ? 'var(--success)' : processingStep === 2 ? 'var(--primary)' : 'var(--bg3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: processingStep >= 2 ? 'var(--bg)' : 'var(--muted2)',
                flexShrink: 0
              }}>
                {processingStep > 2 ? '✓' : processingStep === 2 && <div className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} />}
              </div>
              <span>✨ 결과 생성 중...</span>
            </div>
          </div>

          {/* 예상 시간 */}
          <div style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            fontSize: 12,
            color: 'var(--muted2)',
            textAlign: 'center'
          }}>
            약 15-20초 소요됩니다
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">후보자 관리</div>
          <div className="page-sub">{candidates.length}명 (총 {totalCount}명)</div>
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
          {candidates.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => downloadCandidatesAsCSV(filtered)}
              style={{ fontSize: 13 }}
            >
              📥 엑셀 다운로드
            </button>
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

      {/* 고급 필터 */}
      <div style={{ marginBottom: 16 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
          style={{ fontSize: 13, marginBottom: showAdvancedFilter ? 12 : 0 }}
        >
          {showAdvancedFilter ? '🔽' : '▶️'} 고급 필터
        </button>

        {showAdvancedFilter && (
          <div style={{
            padding: 16,
            background: 'var(--bg3)',
            borderRadius: 8,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
          }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>스킬 검색</label>
              <input
                className="form-input"
                placeholder="예: React, Python"
                value={skillSearch}
                onChange={e => setSkillSearch(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>최소 경력 (년)</label>
              <input
                className="form-input"
                type="number"
                placeholder="0"
                value={minExperience}
                onChange={e => setMinExperience(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>최대 경력 (년)</label>
              <input
                className="form-input"
                type="number"
                placeholder="30"
                value={maxExperience}
                onChange={e => setMaxExperience(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSkillSearch('')
                setMinExperience('')
                setMaxExperience('')
              }}
              style={{ fontSize: 12, gridColumn: '1 / -1', justifyContent: 'center' }}
            >
              ✕ 필터 초기화
            </button>
          </div>
        )}
      </div>

      <div className="filter-bar">
        {STATUS_FILTERS.map(f => (
          <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f} <span style={{ opacity: 0.6 }}>({f === '전체' ? totalCount : (statusCounts[f] ?? 0)})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} /></div>
      ) : finalFiltered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">👤</div>
          <div className="empty-text">등록된 후보자가 없습니다</div>
          <div className="empty-sub">후보자 등록 버튼으로 이력서를 추가하세요</div>
        </div>
      ) : (
        <div className="jd-grid">
          {finalFiltered.map(candidate => (
            <div
              key={candidate.id}
              className="jd-card"
              onClick={() => setSelected(candidate)}
              style={
                candidate.status === '합격'
                  ? {
                      borderLeft: '4px solid #eab308',
                      boxShadow: '0 0 0 1px rgba(234, 179, 8, 0.2), 0 0 12px rgba(234, 179, 8, 0.15)',
                      background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.05) 0%, rgba(250, 204, 21, 0.03) 100%)',
                    }
                  : candidate.status === '활성'
                    ? {
                        borderLeft: '4px solid #10b981',
                        boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.1)',
                      }
                    : candidate.status === '제안중'
                      ? {
                          borderLeft: '4px solid #3b82f6',
                          boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.1)',
                        }
                      : undefined
              }
            >
              <div className="jd-card-top">
                <div className="jd-company">{candidate.current_company ?? '회사명 미기재'}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {candidate.organization && (
                    <span style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'var(--accent)',
                      color: 'var(--bg)',
                      fontWeight: 500
                    }}>
                      🏢 {candidate.organization.name}
                    </span>
                  )}
                  {(candidate.created_by_user || candidate.created_by) && (
                    <span style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'rgba(136, 136, 128, 0.15)',
                      color: 'var(--muted)',
                      fontWeight: 500
                    }}>
                      👤 {candidate.created_by_user?.full_name || (candidate.created_by ? candidate.created_by.split('@')[0] : 'unknown')}
                    </span>
                  )}
                  {candidate.metadata?.job_request?.has_active_request && (
                    <span className="badge" style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                      🔴 구직요청
                    </span>
                  )}
                  <span className={`badge badge-${candidate.status}`}>{candidate.status}</span>
                </div>
              </div>
              <div className="jd-position" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{candidate.name || '이름 미상'}</span>
                {/* 출처 뱃지 */}
                {candidate.source && (
                  <span
                    className="badge"
                    style={{
                      background:
                        candidate.source === 'B2C' ? '#3b82f6' :
                        candidate.source === 'Local' ? '#10b981' :
                        candidate.source === 'B2B' ? '#8b5cf6' :
                        'var(--muted)',
                      color: 'white',
                      fontSize: 10,
                      padding: '2px 6px'
                    }}
                  >
                    {candidate.source === 'B2C' ? '🔵 B2C' :
                     candidate.source === 'Local' ? '🟢 Local' :
                     candidate.source === 'B2B' ? '🟣 B2B' :
                     candidate.source}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 6 }}>
                {candidate.current_position ?? '—'} · {candidate.total_experience_years ? `${candidate.total_experience_years}년` : '경력 미상'}
              </div>
              {(candidate.email || candidate.phone) && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {candidate.email && <div>📧 {candidate.email}</div>}
                  {candidate.phone && <div>📞 {candidate.phone}</div>}
                </div>
              )}
              <div className="jd-meta">
                {candidate.location && <span className="jd-tag">📍 {candidate.location}</span>}
                {candidate.market_value && <span className="jd-tag">💰 {candidate.market_value}</span>}
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
                  {[...(candidate.skills ?? []), ...(candidate.tech_stack ?? [])].slice(0, 5).map((s, i) => <span key={`skill-${i}-${s}`} className="skill-chip">{s}</span>)}
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
                <button
                  className="btn btn-info btn-sm"
                  onClick={() => reanalyzeCandidate(candidate.id)}
                  disabled={reanalyzing === candidate.id}
                  style={{ opacity: reanalyzing === candidate.id ? 0.6 : 1 }}
                >
                  {reanalyzing === candidate.id ? (
                    <>
                      <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, marginRight: 6 }} />
                      재분석 중...
                    </>
                  ) : (
                    '🔄 재분석'
                  )}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteCandidate(candidate.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 더 보기 버튼 */}
      {!loading && hasMore && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn btn-secondary"
            style={{
              padding: '12px 32px',
              opacity: loadingMore ? 0.6 : 1,
              cursor: loadingMore ? 'not-allowed' : 'pointer'
            }}
          >
            {loadingMore ? '로딩 중...' : `더 보기 (${candidates.length}개 표시 중)`}
          </button>
        </div>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div className="overlay" onClick={() => closeModal()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4 }}>{selected.current_company ?? '회사명 미기재'} · {selected.current_position}</div>
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{selected.name}</span>
                  {/* 출처 뱃지 */}
                  {selected.source && (
                    <span
                      className="badge"
                      style={{
                        background:
                          selected.source === 'B2C' ? '#3b82f6' :
                          selected.source === 'Local' ? '#10b981' :
                          selected.source === 'B2B' ? '#8b5cf6' :
                          'var(--muted)',
                        color: 'white',
                        fontSize: 11,
                        padding: '3px 8px'
                      }}
                    >
                      {selected.source === 'B2C' ? '🔵 B2C' :
                       selected.source === 'Local' ? '🟢 Local' :
                       selected.source === 'B2B' ? '🟣 B2B' :
                       selected.source}
                    </span>
                  )}
                </div>
              </div>
              <button className="modal-close" onClick={() => closeModal()}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              <span className={`badge badge-${selected.status}`}>{selected.status}</span>
              {selected.total_experience_years && <span className="badge badge-일반">{selected.total_experience_years}년 경력</span>}
            </div>

            {!isEditing ? (
              <>
                <div className="form-row" style={{ marginBottom: 16 }}>
                  {selected.email && <div><span className="form-label">이메일</span><div>{selected.email}</div></div>}
                  {selected.phone && <div><span className="form-label">전화</span><div>{selected.phone}</div></div>}
                  {selected.birth_year && (
                    <div>
                      <span className="form-label">출생년도(연령)</span>
                      <div>{selected.birth_year}년 ({new Date().getFullYear() - selected.birth_year}세)</div>
                    </div>
                  )}
                  {getFinalEducation(selected.education) && (
                    <div>
                      <span className="form-label">최종학력</span>
                      <div>{getFinalEducation(selected.education)}</div>
                    </div>
                  )}
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
                      {[...(selected.skills ?? []), ...(selected.tech_stack ?? [])].map((s, i) => <span key={`skill-${i}`} className="skill-chip">{s}</span>)}
                    </div>
                  </div>
                )}

                <div className="analysis-box" style={{ marginBottom: 16 }}>
                  <div className="analysis-row">
                    <span className="analysis-label">강점 요약</span>
                    <span className="analysis-value">{selected.strength_summary}</span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">약점 분석</span>
                    <span className="analysis-value">{selected.weakness_summary}</span>
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
                      {selected.ideal_roles.map((r, i) => <span key={`role-${i}-${r}`} className="skill-chip preferred">{r}</span>)}
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
              </>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">이름</div>
                  <input type="text" className="input" value={editForm.name ?? selected.name} onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>

                <div className="form-row" style={{ marginBottom: 16, gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <span className="form-label">이메일</span>
                    <input type="email" className="input" value={editForm.email ?? selected.email ?? ''} onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="form-label">전화</span>
                    <input type="tel" className="input" value={editForm.phone ?? selected.phone ?? ''} onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))} />
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: 16, gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <span className="form-label">출생년도</span>
                    <input type="number" className="input" placeholder="예: 1990" value={editForm.birth_year ?? selected.birth_year ?? ''} onChange={e => setEditForm(prev => ({ ...prev, birth_year: e.target.value ? parseInt(e.target.value) : null }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="form-label">거주지</span>
                    <input type="text" className="input" value={editForm.location ?? selected.location ?? ''} onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))} />
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: 16, gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <span className="form-label">현재 회사</span>
                    <input type="text" className="input" value={editForm.current_company ?? selected.current_company ?? ''} onChange={e => setEditForm(prev => ({ ...prev, current_company: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="form-label">현재 포지션</span>
                    <input type="text" className="input" value={editForm.current_position ?? selected.current_position ?? ''} onChange={e => setEditForm(prev => ({ ...prev, current_position: e.target.value }))} />
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: 16, gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <span className="form-label">총 경력 (년)</span>
                    <input type="number" className="input" value={editForm.total_experience_years ?? selected.total_experience_years ?? ''} onChange={e => setEditForm(prev => ({ ...prev, total_experience_years: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="form-label">시장가치</span>
                    <input type="text" className="input" value={editForm.market_value ?? selected.market_value ?? ''} onChange={e => setEditForm(prev => ({ ...prev, market_value: e.target.value }))} />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">경력 요약</div>
                  <textarea className="input" rows={3} value={editForm.career_summary ?? selected.career_summary ?? ''} onChange={e => setEditForm(prev => ({ ...prev, career_summary: e.target.value }))} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">강점 요약</div>
                  <textarea className="input" rows={2} value={editForm.strength_summary ?? selected.strength_summary ?? ''} onChange={e => setEditForm(prev => ({ ...prev, strength_summary: e.target.value }))} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">약점 분석</div>
                  <textarea className="input" rows={2} value={editForm.weakness_summary ?? selected.weakness_summary ?? ''} onChange={e => setEditForm(prev => ({ ...prev, weakness_summary: e.target.value }))} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">커리어 방향</div>
                  <textarea className="input" rows={2} value={editForm.career_trajectory ?? selected.career_trajectory ?? ''} onChange={e => setEditForm(prev => ({ ...prev, career_trajectory: e.target.value }))} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!isEditing ? (
                <>
                  <button className="btn btn-success" onClick={() => setShowJdRecommendModal(true)}>
                    🎯 JD 추천
                  </button>
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
                  <button className="btn btn-primary" onClick={() => {
                    setIsEditing(true)
                    setEditForm({
                      name: selected.name,
                      email: selected.email,
                      phone: selected.phone,
                      location: selected.location,
                      current_company: selected.current_company,
                      current_position: selected.current_position,
                      total_experience_years: selected.total_experience_years,
                      market_value: selected.market_value,
                      career_summary: selected.career_summary,
                      strength_summary: selected.strength_summary,
                      weakness_summary: selected.weakness_summary,
                      career_trajectory: selected.career_trajectory,
                    })
                  }}>✏️ 수정</button>
                  {isOwner && (
                    <button className="btn btn-ghost" onClick={() => setShowTransferModal(true)}>
                      👥 소유권 이전
                    </button>
                  )}
                  <button
                    className="btn btn-info"
                    onClick={() => reanalyzeCandidate(selected.id)}
                    disabled={reanalyzing === selected.id}
                    style={{ opacity: reanalyzing === selected.id ? 0.6 : 1 }}
                  >
                    {reanalyzing === selected.id ? (
                      <>
                        <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 8 }} />
                        재분석 중...
                      </>
                    ) : (
                      '🔄 재분석'
                    )}
                  </button>
                  <button className="btn btn-danger" onClick={() => { deleteCandidate(selected.id); closeModal() }}>삭제</button>
                </>
              ) : (
                <>
                  <button className="btn btn-success" onClick={updateCandidate}>💾 저장</button>
                  <button className="btn btn-ghost" onClick={() => { setIsEditing(false); setEditForm({}) }}>취소</button>
                </>
              )}
            </div>

            {/* 🔍 디버그: Adam 분석 데이터 */}
            {selected.metadata?.adam_analysis_data && (
              <details style={{
                marginTop: 24,
                padding: 16,
                background: 'rgba(255, 200, 0, 0.05)',
                border: '1px solid rgba(255, 200, 0, 0.3)',
                borderRadius: 8
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#f59e0b' }}>
                  🔍 디버그: Adam 분석 데이터
                </summary>
                <pre style={{
                  marginTop: 12,
                  padding: 12,
                  background: '#000',
                  color: '#0f0',
                  fontSize: 11,
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 300
                }}>
                  {JSON.stringify(selected.metadata.adam_analysis_data, null, 2)}
                </pre>
              </details>
            )}

            {/* 코멘트 섹션 */}
            <div style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  💬 코멘트 ({comments.length})
                </h3>
                {!showCommentForm && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowCommentForm(true)}
                  >
                    ➕ 코멘트 추가
                  </button>
                )}
              </div>

              {/* 코멘트 작성 폼 */}
              {showCommentForm && (
                <div style={{
                  background: 'var(--bg3)',
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 16
                }}>
                  <textarea
                    className="form-input"
                    placeholder="코멘트를 입력하세요..."
                    rows={3}
                    value={commentContent}
                    onChange={e => setCommentContent(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={createComment}
                      disabled={!commentContent.trim()}
                    >
                      💾 저장
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setShowCommentForm(false)
                        setCommentContent('')
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              {/* 코멘트 목록 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {comments.length === 0 ? (
                  <div style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--muted2)',
                    fontSize: 14
                  }}>
                    아직 코멘트가 없습니다.
                  </div>
                ) : (
                  comments.map(comment => (
                    <div
                      key={comment.id}
                      style={{
                        background: 'var(--bg3)',
                        padding: 12,
                        borderRadius: 8,
                        position: 'relative'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                            {comment.profiles?.full_name || comment.author_email}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
                            {new Date(comment.created_at).toLocaleString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => deleteComment(comment.id)}
                          style={{ padding: '4px 8px', fontSize: 12 }}
                        >
                          🗑️
                        </button>
                      </div>
                      <div style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: 'var(--text)',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {comment.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 소유권 이전 모달 */}
            {showTransferModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001,
              }} onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowTransferModal(false)
                  setTransferTarget('')
                }
              }}>
                <div style={{
                  background: 'var(--bg2)',
                  borderRadius: 12,
                  padding: 24,
                  width: 400,
                  maxWidth: '90vw',
                  border: '2px solid var(--border)',
                }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                    후보자 소유권 이전
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                    "{selected.name}" 후보자의 소유권을 다른 멤버에게 이전합니다.
                  </div>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">이전받을 멤버</label>
                    <select
                      className="form-select"
                      value={transferTarget}
                      onChange={e => setTransferTarget(e.target.value)}
                    >
                      <option value="">멤버 선택</option>
                      {orgMembers
                        .filter(u => u.email !== selected.created_by)
                        .map(u => (
                          <option key={u.id} value={u.email}>
                            {u.full_name || u.email} ({u.role === 'owner' ? '오너' : u.role === 'headhunter' ? 'PM' : u.role})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={transferOwnership}
                      disabled={transferring || !transferTarget}
                    >
                      {transferring ? '이전 중...' : '✅ 이전하기'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setShowTransferModal(false)
                        setTransferTarget('')
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* JD 추천 모달 */}
      {showJdRecommendModal && selected && (
        <div className="overlay" onClick={() => setShowJdRecommendModal(false)}>
          <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">JD 추천</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {selected.name} · {selected.current_position ?? '포지션 미상'}
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowJdRecommendModal(false)}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              {jdsLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>JD 목록 로딩 중...</div>
                </div>
              ) : jds.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📋</div>
                  <div className="empty-text">JD가 없습니다</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {jds.map(jd => {
                    const match = jdMatches[jd.id]
                    return (
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
                            {jd.status} · {jd.organizations?.name}
                          </div>
                          {match && (
                            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{
                                fontSize: 18,
                                fontWeight: 700,
                                color: match.match_score >= 80 ? '#22c55e' : match.match_score >= 70 ? '#eab308' : '#ef4444'
                              }}>
                                {match.match_score}점
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {match.recommendation === '추천' ? '✅ 추천' : match.recommendation === '보류' ? '⏸️ 보류' : '❌ 부적합'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {!match ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => matchJD(jd.id)}
                              disabled={matchingJdId === jd.id}
                              style={{ minWidth: 100 }}
                            >
                              {matchingJdId === jd.id ? (
                                <>
                                  <div className="spinner" style={{ width: 12, height: 12 }} />
                                  분석 중...
                                </>
                              ) : (
                                '🎯 매칭 분석'
                              )}
                            </button>
                          ) : (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => addJDToPipeline(jd.id)}
                              style={{ minWidth: 100 }}
                            >
                              ✅ 프로세스 추가
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {jds.length > 0 && (
              <div style={{ padding: 12, background: 'var(--info-bg)', borderRadius: 8, fontSize: 13, color: 'var(--info)' }}>
                💡 각 JD의 "매칭 분석" 버튼을 클릭하면 AI가 후보자와의 적합도를 분석합니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </main>
  )
}

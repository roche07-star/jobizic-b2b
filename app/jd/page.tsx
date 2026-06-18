'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getProfile } from '@/lib/auth'
import { downloadJDsAsCSV } from '@/lib/csv-export'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ToastContainer'

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
  created_by?: string
  created_by_user?: {
    id: string
    full_name: string | null
    email: string
  }
  active_candidates?: Array<{
    id: string
    stage: string
    candidate_id: string
    candidates: {
      id: string
      name: string
      email: string | null
      current_company: string | null
      current_position: string | null
    }
  }>
}

interface BoardPost {
  id: string
  jd_id: string
  author_id: string
  author_email: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

const STATUS_FILTERS = ['전체', '검토중', '활성', '마감', '보류']
const PRIORITY_FILTERS = ['전체', '긴급', '높음', '보통', '낮음']

interface Organization {
  id: string
  name: string
}

export default function JDPage() {
  const { toasts, success, error, info, removeToast } = useToast()
  const [jds, setJds] = useState<JD[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [priorityFilter, setPriorityFilter] = useState('전체')
  const [selected, setSelected] = useState<JD | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('전체')
  const [viewMode, setViewMode] = useState<'all' | 'interest'>('all')
  const [interests, setInterests] = useState<string[]>([])
  const [modalTab, setModalTab] = useState<'overview' | 'board'>('overview')
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([])
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardForm, setBoardForm] = useState({ title: '', content: '' })
  const [showBoardForm, setShowBoardForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<JD>>({})

  useEffect(() => {
    async function loadOrganizations() {
      const profile = await getProfile()
      if (!profile) return

      setIsAdmin(profile.role === 'admin')
      setUserEmail(profile.email)
      setUserRole(profile.role)
      setUserId(profile.id)

      if (profile.role === 'admin') {
        const res = await fetch('/api/admin/organizations')
        const data = await res.json()
        setOrganizations(data.organizations ?? [])
      }

      // 관심 JD 목록 로드
      const interestRes = await fetch(`/api/jd/interests?user_id=${profile.id}`)
      const interestData = await interestRes.json()
      setInterests(interestData.jd_ids || [])
    }
    loadOrganizations()
  }, [])

  useEffect(() => {
    async function loadJDs() {
      const profile = await getProfile()
      if (!profile) return

      const params = new URLSearchParams({
        role: profile.role,
        user_email: profile.email, // 🔥 필수! API 필터링에 필요
        ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
        ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
      })

      console.log('[JD Page] Loading JDs with params:', Object.fromEntries(params))
      console.log('[JD Page] Profile:', { role: profile.role, org_id: profile.organization_id })

      fetch(`/api/jd?${params}`)
        .then(r => {
          console.log('[JD Page] Response status:', r.status)
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`)
          }
          return r.json()
        })
        .then(d => {
          console.log('[JD Page] Loaded JDs:', d.jds?.length)
          setJds(d.jds ?? [])
        })
        .catch(err => {
          console.error('[JD Page] Error loading JDs:', err)
          error('JD 목록을 불러오는데 실패했습니다: ' + err.message)
        })
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
    const params = new URLSearchParams({
      user_email: userEmail,
      user_role: userRole,
    })
    const res = await fetch(`/api/jd/${id}?${params}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      error(data.error || '삭제 실패')
      return
    }
    setJds(prev => prev.filter(j => j.id !== id))
    if (selected?.id === id) closeModal()
  }

  function closeModal() {
    setSelected(null)
    setModalTab('overview')
    setBoardPosts([])
    setBoardForm({ title: '', content: '' })
    setShowBoardForm(false)
  }

  // 게시판 글 목록 로드
  async function loadBoardPosts(jdId: string) {
    setBoardLoading(true)
    try {
      const res = await fetch(`/api/jd/${jdId}/board`, {
        headers: { 'x-user-email': userEmail }
      })
      const data = await res.json()
      if (res.ok) {
        setBoardPosts(data.posts || [])
      } else {
        console.error('[Board] Load error:', data.error)
      }
    } catch (e) {
      console.error('[Board] Load exception:', e)
    } finally {
      setBoardLoading(false)
    }
  }

  // 게시글 작성
  async function createBoardPost() {
    if (!selected || !boardForm.title.trim() || !boardForm.content.trim()) {
      error('제목과 내용을 입력해주세요.')
      return
    }

    try {
      const res = await fetch(`/api/jd/${selected.id}/board`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify(boardForm)
      })
      const data = await res.json()
      if (res.ok) {
        setBoardPosts([data.post, ...boardPosts])
        setBoardForm({ title: '', content: '' })
        setShowBoardForm(false)
      } else {
        error(data.error || '작성 실패')
      }
    } catch (e) {
      console.error('[Board] Create exception:', e)
      error('작성 중 오류가 발생했습니다.')
    }
  }

  // 게시글 삭제
  async function deleteBoardPost(postId: string) {
    if (!selected || !confirm('이 게시글을 삭제할까요?')) return

    try {
      const res = await fetch(`/api/jd/${selected.id}/board/${postId}`, {
        method: 'DELETE',
        headers: { 'x-user-email': userEmail }
      })
      if (res.ok) {
        setBoardPosts(prev => prev.filter(p => p.id !== postId))
      } else {
        const data = await res.json()
        error(data.error || '삭제 실패')
      }
    } catch (e) {
      console.error('[Board] Delete exception:', e)
      error('삭제 중 오류가 발생했습니다.')
    }
  }

  // JD 우선순위 변경
  async function updatePriority(jdId: string, newPriority: string) {
    try {
      const res = await fetch(`/api/jd/${jdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: newPriority,
          user_email: userEmail,
          user_role: userRole
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        error(`우선순위 변경 실패: ${errorData.error || '서버 오류'}`)
        return
      }

      // 성공 시 JD 목록 갱신
      setJds(prev => prev.map(j => j.id === jdId ? { ...j, priority: newPriority } : j))
      success(`✅ 우선순위가 '${newPriority}'로 변경되었습니다!`)
    } catch (err) {
      console.error('[updatePriority] Error:', err)
      error('❌ 우선순위 변경 중 오류가 발생했습니다.')
    }
  }

  // 관심 JD 필터링
  const viewFiltered = viewMode === 'all'
    ? jds
    : jds.filter(j => j.created_by === userEmail || interests.includes(j.id))

  const statusFiltered = filter === '전체' ? viewFiltered : viewFiltered.filter(j => j.status === filter)
  const priorityFiltered = priorityFilter === '전체' ? statusFiltered : statusFiltered.filter(j => j.priority === priorityFilter)

  // 상태 + 우선순위 정렬 (활성/긴급이 최우선)
  const statusPriority: Record<string, number> = {
    '활성': 1,
    '검토중': 2,
    '마감': 3,
    '보류': 4,
  }

  const jdPriority: Record<string, number> = {
    '긴급': 1,
    '높음': 2,
    '보통': 3,
    '낮음': 4,
  }

  const filtered = [...priorityFiltered].sort((a, b) => {
    const statusA = statusPriority[a.status] || 999
    const statusB = statusPriority[b.status] || 999

    // 1차: 상태 우선순위
    if (statusA !== statusB) {
      return statusA - statusB
    }

    // 2차: JD 우선순위
    const priorityA = jdPriority[a.priority] || 999
    const priorityB = jdPriority[b.priority] || 999

    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }

    // 3차: 최신순
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // JD 수정
  async function startEditJD(jd: JD) {
    setEditForm({
      company: jd.company,
      position: jd.position,
      location: jd.location,
      salary_estimate: jd.salary_estimate,
      priority: jd.priority,
      difficulty: jd.difficulty,
      status: jd.status,
      target_profile: jd.target_profile,
      search_strategy: jd.search_strategy,
      difficulty_reason: jd.difficulty_reason,
      raw_text: jd.raw_text
    })
    setEditMode(true)
  }

  async function saveJD() {
    if (!selected) return

    try {
      const res = await fetch(`/api/jd/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          user_email: userEmail,
          user_role: userRole
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        error(`수정 실패: ${errorData.error || '서버 오류'}`)
        return
      }

      // 성공 시 JD 목록 갱신
      const updatedJD = { ...selected, ...editForm }
      setJds(prev => prev.map(j => j.id === selected.id ? updatedJD as JD : j))
      setSelected(updatedJD as JD)
      setEditMode(false)
      success('✅ JD가 수정되었습니다!')

      // 추천된 후보자가 있으면 자동으로 재분석 (백그라운드)
      if (selected.active_candidates && selected.active_candidates.length > 0) {
        reanalyzeCandidates(updatedJD as JD)
      }
    } catch (err) {
      console.error('[updateJD] Error:', err)
      error('❌ 수정 중 오류가 발생했습니다.')
    }
  }

  // 후보자 재분석 (백그라운드)
  async function reanalyzeCandidates(jd: JD) {
    if (!jd.active_candidates || jd.active_candidates.length === 0) return

    try {
      console.log(`[Reanalyze] 백그라운드 재분석 시작: ${jd.active_candidates.length}명`)

      let successCount = 0
      let failCount = 0
      const errors: string[] = []

      for (const ac of jd.active_candidates) {
        try {
          // 후보자 정보 조회
          console.log(`[Reanalyze] Step 1: Fetching candidate ${ac.candidate_id}...`)
          const candidateRes = await fetch(`/api/candidates/${ac.candidate_id}`)
          if (!candidateRes.ok) {
            const errorMsg = `후보자 조회 실패 (${ac.candidate_id}): ${candidateRes.status}`
            console.error(`[Reanalyze] ${errorMsg}`)
            errors.push(errorMsg)
            failCount++
            continue
          }
          const candidate = await candidateRes.json()
          console.log(`[Reanalyze] ✓ Candidate loaded: ${candidate.name}`)

          // 매칭 점수 재계산
          console.log(`[Reanalyze] Step 2: Calculating match score...`)
          const matchRes = await fetch('/api/pipeline/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jd, candidate })
          })

          if (!matchRes.ok) {
            const errorText = await matchRes.text()
            const errorMsg = `매칭 분석 실패 (${candidate.name}): ${matchRes.status} - ${errorText}`
            console.error(`[Reanalyze] ${errorMsg}`)
            errors.push(errorMsg)
            failCount++
            continue
          }

          const matchResult = await matchRes.json()
          const newScore = matchResult.match_score
          console.log(`[Reanalyze] ✓ Match score: ${newScore}`)

          // Pipeline 업데이트
          console.log(`[Reanalyze] Step 3: Updating pipeline...`)
          const updateRes = await fetch(`/api/pipeline/${ac.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              match_score: newScore,
              user_email: userEmail,
              user_role: userRole
            })
          })

          if (updateRes.ok) {
            console.log(`[Reanalyze] ✅ ${candidate.name}: ${newScore}점`)
            successCount++
          } else {
            const errorText = await updateRes.text()
            const errorMsg = `점수 업데이트 실패 (${candidate.name}): ${updateRes.status} - ${errorText}`
            console.error(`[Reanalyze] ${errorMsg}`)
            errors.push(errorMsg)
            failCount++
          }

        } catch (err: any) {
          const errorMsg = `예외 발생 (${ac.candidate_id}): ${err.message}`
          console.error(`[Reanalyze] ${errorMsg}`, err)
          errors.push(errorMsg)
          failCount++
        }
      }

      // 결과 로깅만 (완전히 조용히)
      console.log(`[Reanalyze] 백그라운드 재분석 완료: 성공 ${successCount}명, 실패 ${failCount}명`)

      // 실패가 있으면 콘솔에 상세 출력
      if (failCount > 0 && errors.length > 0) {
        console.error('[Reanalyze] 실패 목록:', errors)
      }

      // 성공 시 자동 새로고침 (알림 없이)
      if (successCount > 0) {
        console.log('[Reanalyze] 페이지 새로고침...')
        window.location.reload()
      }
    } catch (error: any) {
      console.error('[Reanalyze] 치명적 오류:', error)
      // 알림 없이 콘솔에만 로그
    }
  }

  // 관심 등록/해제
  async function toggleInterest(jdId: string) {
    const isInterested = interests.includes(jdId)

    if (isInterested) {
      // 관심 해제
      const res = await fetch(`/api/jd/interests?user_id=${userId}&jd_id=${jdId}`, { method: 'DELETE' })
      if (res.ok) {
        setInterests(prev => prev.filter(id => id !== jdId))
      }
    } else {
      // 관심 등록
      const res = await fetch('/api/jd/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, jd_id: jdId })
      })
      if (res.ok) {
        setInterests(prev => [...prev, jdId])
        // 관심 등록 후 자동으로 관심 JD 탭으로 전환
        setViewMode('interest')
      }
    }
  }

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
          {jds.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => downloadJDsAsCSV(filtered)}
              style={{ fontSize: 13 }}
            >
              📥 엑셀 다운로드
            </button>
          )}
          <Link href="/jd/new">
            <button className="btn btn-primary">+ JD 등록</button>
          </Link>
        </div>
      </div>

      {/* 전체 JD / 관심 JD 탭 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          className={`btn${viewMode === 'all' ? ' btn-primary' : ' btn-ghost'}`}
          onClick={() => setViewMode('all')}
          style={{ fontSize: 13 }}
        >
          📋 전체 JD ({jds.length})
        </button>
        <button
          className={`btn${viewMode === 'interest' ? ' btn-primary' : ' btn-ghost'}`}
          onClick={() => setViewMode('interest')}
          style={{ fontSize: 13 }}
        >
          ⭐ 관심 JD ({jds.filter(j => j.created_by === userEmail || interests.includes(j.id)).length})
        </button>
      </div>

      <div className="filter-bar">
        {STATUS_FILTERS.map(f => (
          <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f} {f !== '전체' && <span style={{ opacity: 0.6 }}>({viewFiltered.filter(j => j.status === f).length})</span>}
          </button>
        ))}
      </div>

      <div className="filter-bar" style={{ marginTop: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted2)', marginRight: 8 }}>우선순위:</span>
        {PRIORITY_FILTERS.map(f => (
          <button key={f} className={`filter-btn${priorityFilter === f ? ' active' : ''}`} onClick={() => setPriorityFilter(f)}>
            {f} {f !== '전체' && <span style={{ opacity: 0.6 }}>({statusFiltered.filter(j => j.priority === f).length})</span>}
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
            <div
              key={jd.id}
              className="jd-card"
              onClick={() => setSelected(jd)}
              style={
                jd.status === '활성' && jd.priority === '긴급'
                  ? {
                      borderLeft: '4px solid #ef4444',
                      boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.2), 0 0 16px rgba(239, 68, 68, 0.2)',
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.03) 100%)',
                    }
                  : jd.status === '활성'
                    ? {
                        borderLeft: '4px solid #10b981',
                        boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.1)',
                      }
                    : jd.priority === '긴급'
                      ? {
                          borderLeft: '4px solid #f97316',
                          boxShadow: '0 0 0 1px rgba(249, 115, 22, 0.15)',
                        }
                      : undefined
              }
            >
              <div className="jd-card-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', width: '100%' }}>
                  <div className="jd-company">{jd.company ?? '회사명 미상'}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (jd.created_by !== userEmail) {
                        toggleInterest(jd.id)
                      }
                    }}
                    style={{
                      background: jd.created_by === userEmail
                        ? 'rgba(74,158,255,0.15)'
                        : interests.includes(jd.id)
                          ? 'rgba(255,215,0,0.15)'
                          : 'rgba(255,255,255,0.05)',
                      border: '1px solid ' + (jd.created_by === userEmail
                        ? '#4a9eff'
                        : interests.includes(jd.id)
                          ? '#ffd700'
                          : '#666'),
                      borderRadius: 3,
                      cursor: jd.created_by === userEmail ? 'default' : 'pointer',
                      fontSize: 14,
                      padding: '2px 4px',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 22,
                      flexShrink: 0,
                      color: jd.created_by === userEmail
                        ? '#4a9eff'
                        : interests.includes(jd.id)
                          ? '#ffd700'
                          : '#ccc',
                    }}
                    title={jd.created_by === userEmail ? '내 JD' : (interests.includes(jd.id) ? '관심 해제' : '관심 등록')}
                  >
                    {(jd.created_by === userEmail || interests.includes(jd.id)) ? '★' : '☆'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', overflow: 'hidden' }}>
                  {/* 상태 - 클릭해서 변경 (최우선 표시) */}
                  {(jd.created_by === userEmail || userRole === 'owner' || userRole === 'admin') ? (
                    <button
                      className={`badge badge-${jd.status}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        const statuses = ['검토중', '활성', '마감', '보류']
                        const currentIndex = statuses.indexOf(jd.status)
                        const nextStatus = statuses[(currentIndex + 1) % statuses.length]
                        updateStatus(jd.id, nextStatus)
                      }}
                      style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                      title="클릭하여 상태 변경"
                    >
                      {jd.status === '활성' ? '✅ ' : jd.status === '마감' ? '🎯 ' : jd.status === '보류' ? '⏸️ ' : '🔍 '}
                      {jd.status}
                    </button>
                  ) : (
                    <span className={`badge badge-${jd.status}`} style={{ fontWeight: 600, fontSize: 12 }}>
                      {jd.status === '활성' ? '✅ ' : jd.status === '마감' ? '🎯 ' : jd.status === '보류' ? '⏸️ ' : '🔍 '}
                      {jd.status}
                    </span>
                  )}
                  {/* 우선순위 - 클릭해서 변경 */}
                  {(() => {
                    // 기존 "중요", "일반" 데이터 자동 매핑
                    const priorityMap: Record<string, string> = {
                      '중요': '긴급',
                      '일반': '보통',
                    }
                    const normalizedPriority = priorityMap[jd.priority] || jd.priority
                    const displayPriority = normalizedPriority

                    return (jd.created_by === userEmail || userRole === 'owner' || userRole === 'admin') ? (
                      <button
                        className={`badge badge-${normalizedPriority}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          const priorities = ['긴급', '높음', '보통', '낮음']
                          const currentIndex = priorities.indexOf(normalizedPriority)
                          const nextPriority = priorities[(currentIndex + 1) % priorities.length]
                          updatePriority(jd.id, nextPriority)
                        }}
                        style={{ cursor: 'pointer' }}
                        title="클릭하여 우선순위 변경"
                      >
                        {displayPriority === '긴급' ? '🔥 ' : displayPriority === '높음' ? '⬆️ ' : displayPriority === '낮음' ? '⬇️ ' : ''}
                        {displayPriority}
                      </button>
                    ) : (
                      <span className={`badge badge-${normalizedPriority}`}>
                        {displayPriority === '긴급' ? '🔥 ' : displayPriority === '높음' ? '⬆️ ' : displayPriority === '낮음' ? '⬇️ ' : ''}
                        {displayPriority}
                      </span>
                    )
                  })()}
                  {/* 담당자 */}
                  {(jd.created_by_user || jd.created_by) && (
                    <span style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'rgba(136, 136, 128, 0.15)',
                      color: 'var(--muted)',
                      fontWeight: 500
                    }}>
                      👤 {jd.created_by_user?.full_name || (jd.created_by ? jd.created_by.split('@')[0] : 'unknown')}
                    </span>
                  )}
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
              {/* 진행 중인 후보자 표시 (JD Owner인 경우만) */}
              {jd.created_by === userEmail && jd.active_candidates && jd.active_candidates.length > 0 && (
                <div style={{
                  marginTop: 12,
                  padding: '8px 10px',
                  background: 'rgba(74, 158, 255, 0.08)',
                  borderRadius: 6,
                  border: '1px solid rgba(74, 158, 255, 0.2)'
                }}>
                  <div style={{ fontSize: 11, color: '#4a9eff', fontWeight: 600, marginBottom: 6 }}>
                    👥 진행 중인 후보자 ({jd.active_candidates.length}명)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {jd.active_candidates.slice(0, 3).map((ac) => (
                      <div key={ac.id} style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-block',
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: '#4a9eff'
                        }} />
                        <span style={{ fontWeight: 500 }}>{ac.candidates.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--muted)', padding: '1px 4px', background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                          {ac.stage}
                        </span>
                      </div>
                    ))}
                    {jd.active_candidates.length > 3 && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        + {jd.active_candidates.length - 3}명 더
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="jd-actions" onClick={e => e.stopPropagation()}>
                {(jd.created_by === userEmail || userRole === 'owner' || userRole === 'admin') && (
                  <>
                    {jd.status === '검토중' && (
                      <button className="btn btn-success btn-sm" onClick={() => updateStatus(jd.id, '활성')}>활성화</button>
                    )}
                    {jd.status === '활성' && (
                      <button className="btn btn-primary btn-sm" onClick={() => updateStatus(jd.id, '마감')}>마감</button>
                    )}
                    {jd.status !== '보류' && jd.status !== '마감' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(jd.id, '보류')}>보류</button>
                    )}
                    {jd.priority !== '긴급' && (
                      <button className="btn btn-warning btn-sm" onClick={() => updatePriority(jd.id, '긴급')}>🔥 긴급</button>
                    )}
                    {jd.priority === '긴급' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => updatePriority(jd.id, '보통')}>↓ 보통</button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => deleteJD(jd.id)}>삭제</button>
                  </>
                )}
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
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {selected.company ?? '회사명 미상'}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (selected.created_by !== userEmail) {
                        toggleInterest(selected.id)
                      }
                    }}
                    style={{
                      background: selected.created_by === userEmail
                        ? 'rgba(74,158,255,0.15)'
                        : interests.includes(selected.id)
                          ? 'rgba(255,215,0,0.15)'
                          : 'rgba(255,255,255,0.05)',
                      border: '1px solid ' + (selected.created_by === userEmail
                        ? '#4a9eff'
                        : interests.includes(selected.id)
                          ? '#ffd700'
                          : '#666'),
                      borderRadius: 3,
                      cursor: selected.created_by === userEmail ? 'default' : 'pointer',
                      fontSize: 14,
                      padding: '2px 4px',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 22,
                      color: selected.created_by === userEmail
                        ? '#4a9eff'
                        : interests.includes(selected.id)
                          ? '#ffd700'
                          : '#ccc',
                    }}
                    title={selected.created_by === userEmail ? '내 JD' : (interests.includes(selected.id) ? '관심 해제' : '관심 등록')}
                  >
                    {(selected.created_by === userEmail || interests.includes(selected.id)) ? '★' : '☆'}
                  </button>
                </div>
                <div className="modal-title">{selected.position}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(selected.created_by === userEmail || userRole === 'owner' || userRole === 'admin') && !editMode && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => startEditJD(selected)}
                    style={{ fontSize: 13, padding: '6px 12px' }}
                  >
                    ✏️ 수정
                  </button>
                )}
                {editMode && (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={saveJD}
                      style={{ fontSize: 13, padding: '6px 12px' }}
                    >
                      ✓ 저장
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditMode(false)}
                      style={{ fontSize: 13, padding: '6px 12px' }}
                    >
                      취소
                    </button>
                  </>
                )}
                <button className="modal-close" onClick={() => { setEditMode(false); closeModal(); }}>✕</button>
              </div>
            </div>

            {/* 탭 버튼 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
              <button
                onClick={() => setModalTab('overview')}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: modalTab === 'overview' ? '2px solid var(--accent)' : '2px solid transparent',
                  color: modalTab === 'overview' ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: modalTab === 'overview' ? 600 : 400,
                  fontSize: 14,
                  cursor: 'pointer',
                  marginBottom: -2,
                }}
              >
                📋 상세정보
              </button>
              {/* 게시판 탭: JD 소유주, Owner, 관심 등록자만 표시 */}
              {(selected.created_by === userEmail || userRole === 'owner' || interests.includes(selected.id)) && (
                <button
                  onClick={() => {
                    setModalTab('board')
                    if (boardPosts.length === 0) loadBoardPosts(selected.id)
                  }}
                  style={{
                    padding: '10px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: modalTab === 'board' ? '2px solid var(--accent)' : '2px solid transparent',
                    color: modalTab === 'board' ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: modalTab === 'board' ? 600 : 400,
                    fontSize: 14,
                    cursor: 'pointer',
                    marginBottom: -2,
                  }}
                >
                  💬 게시판
                </button>
              )}
            </div>

            {modalTab === 'overview' && (
              <>
                {editMode ? (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-row" style={{ marginBottom: 16 }}>
                      <div><span className="form-label">회사</span>
                        <input type="text" className="input" value={editForm.company ?? ''}
                          onChange={e => setEditForm({ ...editForm, company: e.target.value })} />
                      </div>
                      <div><span className="form-label">포지션</span>
                        <input type="text" className="input" value={editForm.position ?? ''}
                          onChange={e => setEditForm({ ...editForm, position: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-row" style={{ marginBottom: 16 }}>
                      <div><span className="form-label">근무지</span>
                        <input type="text" className="input" value={editForm.location ?? ''}
                          onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
                      </div>
                      <div><span className="form-label">예상 연봉</span>
                        <input type="text" className="input" value={editForm.salary_estimate ?? ''}
                          onChange={e => setEditForm({ ...editForm, salary_estimate: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-row" style={{ marginBottom: 16 }}>
                      <div><span className="form-label">우선순위</span>
                        <select className="input" value={editForm.priority ?? '보통'}
                          onChange={e => setEditForm({ ...editForm, priority: e.target.value })}>
                          <option value="긴급">긴급</option>
                          <option value="높음">높음</option>
                          <option value="보통">보통</option>
                          <option value="낮음">낮음</option>
                        </select>
                      </div>
                      <div><span className="form-label">난이도</span>
                        <select className="input" value={editForm.difficulty ?? '보통'}
                          onChange={e => setEditForm({ ...editForm, difficulty: e.target.value })}>
                          <option value="매우 어려움">매우 어려움</option>
                          <option value="어려움">어려움</option>
                          <option value="보통">보통</option>
                          <option value="쉬움">쉬움</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <span className="form-label">상태</span>
                      <select className="input" value={editForm.status ?? '검토중'}
                        onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                        <option value="검토중">검토중</option>
                        <option value="활성">활성</option>
                        <option value="마감">마감</option>
                        <option value="보류">보류</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <span className="form-label">타깃 프로파일</span>
                      <textarea
                        className="form-textarea"
                        rows={6}
                        value={editForm.target_profile ?? ''}
                        onChange={e => setEditForm({ ...editForm, target_profile: e.target.value })}
                        placeholder="예) 현대모비스, 한국델파이, LG이노텍 등에서 전기차 모터 설계 5년 이상 경력자"
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <span className="form-label">서칭 전략</span>
                      <textarea
                        className="form-textarea"
                        rows={6}
                        value={editForm.search_strategy ?? ''}
                        onChange={e => setEditForm({ ...editForm, search_strategy: e.target.value })}
                        placeholder="예) 현대모비스, LG이노텍, 한온시스템 등 Tier1 업체의 전기차 모터 설계 엔지니어 타겟"
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <span className="form-label">난이도 사유</span>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={editForm.difficulty_reason ?? ''}
                        onChange={e => setEditForm({ ...editForm, difficulty_reason: e.target.value })}
                        placeholder="예) 전기차 모터 설계 경력자 수가 제한적이고 대부분 안정적인 대기업 근무 중"
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <span className="form-label">JD 원문</span>
                      <textarea
                        className="form-textarea"
                        rows={10}
                        value={editForm.raw_text ?? ''}
                        onChange={e => setEditForm({ ...editForm, raw_text: e.target.value })}
                        placeholder="JD 전체 원문을 입력하세요. Claude AI가 분석하여 타깃 프로파일, 서칭 전략 등을 자동으로 생성합니다."
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          lineHeight: '1.8'
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                      {/* 상태 배지 - 클릭해서 순환 */}
                      {(selected.created_by === userEmail || userRole === 'owner' || userRole === 'admin') ? (
                        <button
                          className={`badge badge-${selected.status}`}
                          onClick={() => {
                            const statuses = ['검토중', '활성', '마감', '보류']
                            const currentIndex = statuses.indexOf(selected.status)
                            const nextStatus = statuses[(currentIndex + 1) % statuses.length]
                            updateStatus(selected.id, nextStatus)
                            setSelected({...selected, status: nextStatus})
                          }}
                          style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                          title="클릭하여 상태 변경"
                        >
                          {selected.status === '활성' ? '✅ ' : selected.status === '마감' ? '🎯 ' : selected.status === '보류' ? '⏸️ ' : '🔍 '}
                          {selected.status}
                        </button>
                      ) : (
                        <span className={`badge badge-${selected.status}`} style={{ fontSize: 13, fontWeight: 600 }}>
                          {selected.status === '활성' ? '✅ ' : selected.status === '마감' ? '🎯 ' : selected.status === '보류' ? '⏸️ ' : '🔍 '}
                          {selected.status}
                        </span>
                      )}

                      {/* 우선순위 배지 - 클릭해서 순환 */}
                      {(() => {
                        const priorityMap: Record<string, string> = { '중요': '긴급', '일반': '보통' }
                        const displayPriority = priorityMap[selected.priority] || selected.priority

                        return (selected.created_by === userEmail || userRole === 'owner' || userRole === 'admin') ? (
                          <button
                            className={`badge badge-${displayPriority}`}
                            onClick={() => {
                              const priorities = ['긴급', '높음', '보통', '낮음']
                              const currentIndex = priorities.indexOf(displayPriority)
                              const nextPriority = priorities[(currentIndex + 1) % priorities.length]
                              updatePriority(selected.id, nextPriority)
                              setSelected({...selected, priority: nextPriority})
                            }}
                            style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                            title="클릭하여 우선순위 변경"
                          >
                            {displayPriority === '긴급' ? '🔥 ' : displayPriority === '높음' ? '⬆️ ' : displayPriority === '낮음' ? '⬇️ ' : ''}
                            {displayPriority}
                          </button>
                        ) : (
                          <span className={`badge badge-${displayPriority}`} style={{ fontSize: 13, fontWeight: 600 }}>
                            {displayPriority === '긴급' ? '🔥 ' : displayPriority === '높음' ? '⬆️ ' : displayPriority === '낮음' ? '⬇️ ' : ''}
                            {displayPriority}
                          </span>
                        )
                      })()}

                      {/* 난이도 배지 - 표시만 */}
                      <span className={`badge badge-${selected.difficulty}`} style={{ fontSize: 13 }}>난이도 {selected.difficulty}</span>
                    </div>

                    {/* 빠른 변경 버튼 */}
                    {(selected.created_by === userEmail || userRole === 'owner' || userRole === 'admin') && (() => {
                      // 기존 "중요", "일반" 데이터 자동 매핑
                      const priorityMap: Record<string, string> = { '중요': '긴급', '일반': '보통' }
                      const normalizedPriority = priorityMap[selected.priority] || selected.priority

                      return (
                        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                          {selected.status === '검토중' && (
                            <button className="btn btn-success btn-sm" onClick={() => { updateStatus(selected.id, '활성'); setSelected({...selected, status: '활성'}); }}>
                              ✅ 활성화
                            </button>
                          )}
                          {selected.status === '활성' && (
                            <button className="btn btn-primary btn-sm" onClick={() => { updateStatus(selected.id, '마감'); setSelected({...selected, status: '마감'}); }}>
                              🎯 마감
                            </button>
                          )}
                          {selected.status !== '보류' && selected.status !== '마감' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => { updateStatus(selected.id, '보류'); setSelected({...selected, status: '보류'}); }}>
                              ⏸️ 보류
                            </button>
                          )}
                          {normalizedPriority !== '긴급' && (
                            <button className="btn btn-warning btn-sm" onClick={() => { updatePriority(selected.id, '긴급'); setSelected({...selected, priority: '긴급'}); }}>
                              🔥 긴급으로
                            </button>
                          )}
                          {normalizedPriority === '긴급' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => { updatePriority(selected.id, '보통'); setSelected({...selected, priority: '보통'}); }}>
                              ↓ 보통으로
                            </button>
                          )}
                        </div>
                      )
                    })()}


                    {/* 좌우 분할 레이아웃 */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: selected.raw_text ? '1fr 1fr' : '1fr',
                      gap: 24,
                      marginBottom: 20
                    }}>
                      {/* 좌측: JD 원문 */}
                      {selected.raw_text && (
                        <div>
                          <div className="form-label" style={{ marginBottom: 12 }}>📄 JD 원문</div>
                          <div style={{
                            padding: 16,
                            background: 'var(--bg-2)',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            maxHeight: 700,
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontSize: 12,
                            lineHeight: 1.7,
                            color: 'var(--text)'
                          }}>
                            {selected.raw_text}
                          </div>
                        </div>
                      )}

                      {/* 우측: 분석 내용 */}
                      <div>
                        <div className="form-label" style={{ marginBottom: 12 }}>🔍 AI 분석 결과</div>

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
                          <div style={{ marginBottom: 16 }}>
                            <div className="form-label">헤드헌터 주목 포인트</div>
                            <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {selected.key_points.map((p, i) => <li key={i} style={{ fontSize: 13 }}>{p}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* 진행 중인 후보자 목록 (JD Owner인 경우만) */}
                        {selected.created_by === userEmail && selected.active_candidates && selected.active_candidates.length > 0 && (
                          <div>
                            <div className="form-label">👥 진행 중인 후보자 ({selected.active_candidates.length}명)</div>
                            <div style={{
                              padding: 12,
                              background: 'var(--bg-2)',
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              maxHeight: 200,
                              overflowY: 'auto'
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {selected.active_candidates.map((ac) => (
                                  <div key={ac.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 10px',
                                    background: 'var(--bg)',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)'
                                  }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                                        {ac.candidates.name}
                                      </div>
                                      {ac.candidates.current_company && (
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                          {ac.candidates.current_company} {ac.candidates.current_position && `· ${ac.candidates.current_position}`}
                                        </div>
                                      )}
                                    </div>
                                    <span style={{
                                      fontSize: 11,
                                      padding: '4px 8px',
                                      background: 'rgba(74, 158, 255, 0.15)',
                                      color: '#4a9eff',
                                      borderRadius: 4,
                                      fontWeight: 500
                                    }}>
                                      {ac.stage}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

            <div style={{ display: 'flex', gap: 8 }}>
              {(selected.created_by === userEmail || userRole === 'owner' || userRole === 'admin') && (
                <>
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
                </>
              )}
            </div>
              </>
            )}

            {/* 게시판 탭 */}
            {modalTab === 'board' && (selected.created_by === userEmail || userRole === 'owner' || interests.includes(selected.id)) && (
              <div>
                {/* 글쓰기 버튼 */}
                {!showBoardForm && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowBoardForm(true)}
                    style={{ marginBottom: 16, width: '100%' }}
                  >
                    ✏️ 글쓰기
                  </button>
                )}

                {/* 글쓰기 폼 */}
                {showBoardForm && (
                  <div style={{
                    padding: 16,
                    background: 'var(--bg-2)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    marginBottom: 16
                  }}>
                    <input
                      type="text"
                      placeholder="제목"
                      value={boardForm.title}
                      onChange={(e) => setBoardForm({ ...boardForm, title: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginBottom: 10,
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: 14
                      }}
                    />
                    <textarea
                      placeholder="내용을 입력하세요"
                      value={boardForm.content}
                      onChange={(e) => setBoardForm({ ...boardForm, content: e.target.value })}
                      rows={5}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginBottom: 10,
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: 13,
                        lineHeight: 1.5,
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={createBoardPost}>등록</button>
                      <button className="btn btn-ghost" onClick={() => {
                        setShowBoardForm(false)
                        setBoardForm({ title: '', content: '' })
                      }}>취소</button>
                    </div>
                  </div>
                )}

                {/* 게시글 목록 */}
                {boardLoading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </div>
                ) : boardPosts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
                    <div style={{ fontSize: 14 }}>등록된 게시글이 없습니다</div>
                    <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>진행 상황을 공유해보세요</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {boardPosts.map(post => (
                      <div key={post.id} style={{
                        padding: 16,
                        background: 'var(--bg-2)',
                        borderRadius: 8,
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{post.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>✍️ {post.author_email.split('@')[0]}</span>
                              <span>•</span>
                              <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          {(post.author_email === userEmail || selected.created_by === userEmail || userRole === 'owner') && (
                            <button
                              onClick={() => deleteBoardPost(post.id)}
                              style={{
                                padding: '4px 8px',
                                fontSize: 12,
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                borderRadius: 4,
                                color: 'var(--muted)',
                                cursor: 'pointer'
                              }}
                              title="삭제"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                        <div style={{
                          fontSize: 13,
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                          color: 'var(--text)'
                        }}>
                          {post.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </main>
  )
}

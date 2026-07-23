'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { downloadPipelineAsCSV } from '@/lib/csv-export'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ToastContainer'

interface JD {
  id: string
  company: string | null
  position: string
  priority: string
  required_skills: string[]
  preferred_skills: string[]
  created_by: string
}

interface Candidate {
  id: string
  name: string
  email: string | null
  current_company: string | null
  current_position: string | null
  status: string
  skills: string[]
  tech_stack: string[]
  source?: string | null
}

interface PipelineItem {
  id: string
  jd_id: string
  candidate_id: string
  stage: string
  match_score: number | null
  match_reason: string | null
  skill_match_rate: number | null
  strength_for_jd: string[]
  concerns: string[]
  next_action: string | null
  next_action_date: string | null
  priority: string
  is_active: boolean
  job_descriptions: JD
  candidates: Candidate
  created_at: string
  created_by_user?: {
    id: string
    full_name: string | null
    email: string
  }
  jd_owner_user?: {
    id: string
    full_name: string | null
    email: string
  }
}

const STAGES = ['추천', '신규', '서류검토', '1차면접', '2차면접', '최종면접', '처우협의', '합격', '불합격']

interface Organization {
  id: string
  name: string
}

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<PipelineItem[]>([])
  const [jds, setJds] = useState<JD[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMorePipeline, setHasMorePipeline] = useState(false)
  const [hasMoreCandidates, setHasMoreCandidates] = useState(false)
  const [selected, setSelected] = useState<PipelineItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedJd, setSelectedJd] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [matching, setMatching] = useState(false)
  const [reanalyzing, setReanalyzing] = useState<string | null>(null) // 재분석 중인 pipeline ID
  const [clientComment, setClientComment] = useState('') // 클라이언트 코멘트
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('전체')
  const [showManualAddModal, setShowManualAddModal] = useState(false)
  const [manualForm, setManualForm] = useState({
    jd_id: '',
    name: '',
    email: '',
    phone: '',
    current_company: '',
    education: '',
    total_experience_years: ''
  })

  // 백그라운드 처리 상태
  const [processingJobId, setProcessingJobId] = useState<string | null>(null)
  const [processingProgress, setProcessingProgress] = useState(0)

  const { toasts, success, error, info, removeToast } = useToast()

  useEffect(() => {
    async function loadOrganizations() {
      const profile = await getProfile()
      if (!profile) return

      setIsAdmin(profile.role === 'admin')
      setIsOwner(profile.role === 'owner')
      setUserEmail(profile.email)

      if (profile.role === 'admin') {
        const res = await fetch('/api/admin/organizations')
        const data = await res.json()
        setOrganizations(data.organizations ?? [])
      }
    }
    loadOrganizations()
  }, [])

  // 백그라운드 처리 polling
  useEffect(() => {
    const jobId = localStorage.getItem('processing_job_id')
    const jobType = localStorage.getItem('processing_job_type')

    if (!jobId || jobType !== 'pipeline') return

    setProcessingJobId(jobId)
    setProcessingProgress(0)

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        const data = await res.json()

        setProcessingProgress(data.progress || 0)

        if (data.status === 'completed') {
          clearInterval(pollInterval)
          localStorage.removeItem('processing_job_id')
          localStorage.removeItem('processing_job_type')
          const meta = JSON.parse(localStorage.getItem('processing_job_metadata') || '{}')
          localStorage.removeItem('processing_job_metadata')

          try {
            const result = data.result
            console.log('[pipeline] ✅ Matching completed. Result:', result)
            console.log('[pipeline] Metadata:', meta)

            // 프로세스에 저장
            const profile = await getProfile()
            if (!profile) {
              console.error('[pipeline] ❌ Profile not found')
              return
            }

            const pipelineData = {
              jd_id: meta.jd_id,
              candidate_id: meta.candidate_id,
              stage: '신규',
              match_score: result.match_score,
              match_reason: result.match_reason,
              skill_match_rate: result.skill_match_rate,
              experience_match: result.experience_match,
              strength_for_jd: result.strength_for_jd,
              concerns: result.concerns,
              is_active: true,
              organization_id: meta.organization_id,
              created_by: meta.created_by,
            }

            console.log('[pipeline] Saving to pipeline...', pipelineData)

            const saveRes = await fetch('/api/pipeline', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(pipelineData),
            })

            console.log('[pipeline] Save response status:', saveRes.status)

            if (!saveRes.ok) {
              const errorData = await saveRes.json()
              console.error('[pipeline] ❌ Save error response:', errorData)
              throw new Error(errorData.error || '프로세스 저장 실패')
            }

            console.log('[pipeline] ✅ Pipeline saved successfully')

            // 목록 새로고침
            const params = new URLSearchParams({
              role: profile.role,
              user_email: profile.email,
              ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
              ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
            })
            const refreshRes = await fetch(`/api/pipeline?${params}`, {
              cache: 'no-store',
              headers: { 'Cache-Control': 'no-cache' }
            })
            const refreshData = await refreshRes.json()
            setPipeline(refreshData.pipeline ?? [])
            setProcessingJobId(null)
            success('✅ JD-후보자 매칭이 완료되어 프로세스에 추가되었습니다!')
          } catch (err) {
            console.error('[pipeline] Save error:', err)
            error('❌ 프로세스 저장 실패')
            setProcessingJobId(null)
          }
        } else if (data.status === 'failed') {
          clearInterval(pollInterval)
          localStorage.removeItem('processing_job_id')
          localStorage.removeItem('processing_job_type')
          localStorage.removeItem('processing_job_metadata')
          setProcessingJobId(null)
          error('❌ JD-후보자 매칭 분석 실패')
        }
      } catch (err) {
        console.error('[pipeline/poll] Error:', err)
      }
    }, 2000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [])

  useEffect(() => {
    async function loadData() {
      const profile = await getProfile()
      if (!profile) return

      const params = new URLSearchParams({
        role: profile.role,
        user_email: profile.email,
        ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
        ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
      })

      // Cache 방지 옵션 (간헐적 권한 버그 방지)
      const fetchOptions: RequestInit = {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }

      Promise.all([
        fetch(`/api/pipeline?${params}`, fetchOptions).then(r => r.json()).then(d => {
          setPipeline(d.pipeline ?? [])
          setHasMorePipeline(d.hasMore ?? false)
        }),
        fetch(`/api/jd?${params}`, fetchOptions).then(r => r.json()).then(d => setJds(d.jds ?? [])),
        fetch(`/api/candidates?${params}`, fetchOptions).then(r => r.json()).then(d => {
          setCandidates(d.candidates ?? [])
          setHasMoreCandidates(d.hasMore ?? false)
        })
      ]).finally(() => setLoading(false))
    }
    loadData()
  }, [selectedOrgId])

  // 브라우저 알림 권한 요청
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // 브라우저 알림 표시 함수
  function showNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/icon-192.png',
        tag: 'pipeline-match',
      })
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    }
  }

  // 더 보기 함수
  async function loadMorePipeline() {
    if (loadingMore || !hasMorePipeline) return
    setLoadingMore(true)

    try {
      const profile = await getProfile()
      if (!profile) return

      const params = new URLSearchParams({
        role: profile.role,
        user_email: profile.email,
        limit: '50',
        offset: pipeline.length.toString(),
        ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
        ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
      })

      const res = await fetch(`/api/pipeline?${params}`)
      const data = await res.json()

      setPipeline(prev => [...prev, ...(data.pipeline ?? [])])
      setHasMorePipeline(data.hasMore ?? false)
    } catch (err) {
      console.error('Failed to load more pipeline:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  async function loadMoreCandidates() {
    if (loadingMore || !hasMoreCandidates) return
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
      setHasMoreCandidates(data.hasMore ?? false)
    } catch (err) {
      console.error('Failed to load more candidates:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  async function addToPipeline() {
    if (!selectedJd || !selectedCandidate) return
    setMatching(true)

    try {
      // organization_id 가져오기
      const profile = await getProfile()
      if (!profile?.organization_id) {
        error('조직 정보가 없습니다. 관리자에게 문의하세요.')
        setMatching(false)
        return
      }

      // JD와 후보자 정보 가져오기
      const jd = jds.find(j => j.id === selectedJd)
      const candidate = candidates.find(c => c.id === selectedCandidate)

      console.log('[Pipeline Add] Creating background job for matching...')

      // 1. Match Job 생성
      const res = await fetch('/api/pipeline/match-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_id: selectedJd,
          candidate_id: selectedCandidate,
          jd,
          candidate,
          organization_id: profile.organization_id,
          created_by: profile.email
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        error(data.error)
        setMatching(false)
        return
      }

      // 2. localStorage에 저장 (백그라운드 처리용)
      const { jobId } = data
      console.log('[Pipeline Add] Job created:', jobId)

      localStorage.setItem('processing_job_id', jobId)
      localStorage.setItem('processing_job_type', 'pipeline')
      localStorage.setItem('processing_job_metadata', JSON.stringify({
        jd_id: selectedJd,
        candidate_id: selectedCandidate,
        organization_id: profile.organization_id,
        created_by: profile.email
      }))

      // 3. Process API 백그라운드 호출
      fetch(`/api/jobs/${jobId}/process`, { method: 'POST' })
        .catch(err => console.error('[Pipeline Add] Process error:', err))

      // 4. 상태 설정 (polling 시작)
      setProcessingJobId(jobId)
      setProcessingProgress(10)

      // 5. Polling 시작
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/jobs/${jobId}`)
          const pollData = await pollRes.json()

          setProcessingProgress(pollData.progress || 0)

          if (pollData.status === 'completed') {
            clearInterval(pollInterval)
            localStorage.removeItem('processing_job_id')
            localStorage.removeItem('processing_job_type')
            const meta = JSON.parse(localStorage.getItem('processing_job_metadata') || '{}')
            localStorage.removeItem('processing_job_metadata')

            try {
              const result = pollData.result
              console.log('[pipeline] ✅ Matching completed. Result:', result)
              console.log('[pipeline] Metadata:', meta)

              const pipelineData = {
                jd_id: meta.jd_id,
                candidate_id: meta.candidate_id,
                stage: '신규',
                match_score: result.match_score,
                match_reason: result.match_reason,
                skill_match_rate: result.skill_match_rate,
                experience_match: result.experience_match,
                strength_for_jd: result.strength_for_jd,
                concerns: result.concerns,
                is_active: true,
                organization_id: meta.organization_id,
                created_by: meta.created_by,
              }

              console.log('[pipeline] Saving to pipeline...', pipelineData)

              const saveRes = await fetch('/api/pipeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pipelineData),
              })

              console.log('[pipeline] Save response status:', saveRes.status)

              if (!saveRes.ok) {
                const errorData = await saveRes.json()
                console.error('[pipeline] ❌ Save error response:', errorData)
                throw new Error(errorData.error || '프로세스 저장 실패')
              }

              console.log('[pipeline] ✅ Pipeline saved successfully')

              // 목록 새로고침
              const params = new URLSearchParams({
                role: profile.role,
                user_email: profile.email,
                ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
                ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
              })
              const refreshRes = await fetch(`/api/pipeline?${params}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
              })
              const refreshData = await refreshRes.json()
              setPipeline(refreshData.pipeline ?? [])
              setProcessingJobId(null)
              success('✅ JD-후보자 매칭이 완료되어 프로세스에 추가되었습니다!')
            } catch (err) {
              console.error('[pipeline] Save error:', err)
              error('❌ 프로세스 저장 실패')
              setProcessingJobId(null)
            }
          } else if (pollData.status === 'failed') {
            clearInterval(pollInterval)
            localStorage.removeItem('processing_job_id')
            localStorage.removeItem('processing_job_type')
            localStorage.removeItem('processing_job_metadata')
            setProcessingJobId(null)
            error('❌ JD-후보자 매칭 분석 실패')
          }
        } catch (err) {
          console.error('[pipeline/poll] Error:', err)
        }
      }, 2000)

      // 6. 모달 닫기 및 상태 초기화
      setShowAddModal(false)
      setSelectedJd('')
      setSelectedCandidate('')
      success('✅ 백그라운드에서 AI 매칭 분석 중입니다...')

    } catch (e) {
      error('추가 중 오류가 발생했습니다.')
    } finally {
      setMatching(false)
    }
  }

  // 수동 후보자 추가
  async function addManualCandidate() {
    if (!manualForm.jd_id || !manualForm.name) {
      error('JD와 이름은 필수입니다.')
      return
    }

    setMatching(true)
    try {
      const profile = await getProfile()
      if (!profile?.organization_id) {
        error('조직 정보가 없습니다.')
        setMatching(false)
        return
      }

      // 이메일 중복 체크 (이메일이 입력된 경우만)
      if (manualForm.email) {
        const dupRes = await fetch(`/api/candidates/check-duplicate?email=${encodeURIComponent(manualForm.email)}&organization_id=${profile.organization_id}`)
        const dupData = await dupRes.json()
        if (dupData.exists) {
          error(`이미 등록된 이메일입니다. (후보자: ${dupData.candidate.name})`)
          setMatching(false)
          return
        }
      }

      // 1. 먼저 candidates 테이블에 후보자 생성
      const candidateRes = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualForm.name,
          email: manualForm.email || null,
          phone: manualForm.phone || null,
          current_company: manualForm.current_company || null,
          education: manualForm.education ? [manualForm.education] : [],
          total_experience_years: manualForm.total_experience_years ? parseInt(manualForm.total_experience_years) : null,
          organization_id: profile.organization_id,
          created_by: profile.email,
          status: '검토중',
          source: 'Manual', // 직접 입력 플래그
          raw_resume: `[직접 입력]

이름: ${manualForm.name}
${manualForm.email ? `이메일: ${manualForm.email}` : ''}
${manualForm.phone ? `전화: ${manualForm.phone}` : ''}
${manualForm.current_company ? `현재 회사: ${manualForm.current_company}` : ''}
${manualForm.education ? `최종학력: ${manualForm.education}` : ''}
${manualForm.total_experience_years ? `경력: ${manualForm.total_experience_years}년` : ''}`
        })
      })

      if (!candidateRes.ok) {
        const data = await candidateRes.json()
        error(data.error || '후보자 생성 실패')
        setMatching(false)
        return
      }

      const candidateData = await candidateRes.json()

      // 2. 프로세스에 추가
      const pipelineRes = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_id: manualForm.jd_id,
          candidate_id: candidateData.id,
          organization_id: profile.organization_id,
          created_by: profile.email,
          stage: '검토'
        })
      })

      if (!pipelineRes.ok) {
        const data = await pipelineRes.json()
        error(data.error || '프로세스 추가 실패')
        setMatching(false)
        return
      }

      // 목록 새로고침
      const params = new URLSearchParams({
        role: profile.role,
        user_email: profile.email,
        ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
        ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
      })
      const refreshRes = await fetch(`/api/pipeline?${params}`)
      const refreshData = await refreshRes.json()
      setPipeline(refreshData.pipeline ?? [])

      success('✅ 후보자가 프로세스에 추가되었습니다!')
      setShowManualAddModal(false)
      setManualForm({
        jd_id: '',
        name: '',
        email: '',
        phone: '',
        current_company: '',
        education: '',
        total_experience_years: ''
      })
    } catch (err) {
      console.error('[addManualCandidate] Error:', err)
      error('추가 중 오류가 발생했습니다.')
    } finally {
      setMatching(false)
    }
  }

  async function updateStage(id: string, stage: string) {
    const profile = await getProfile()
    if (!profile) {
      error('로그인이 필요합니다.')
      return
    }

    // 불합격 단계일 경우 사유 필수 입력
    let rejectionReason: string | null = null
    if (stage === '불합격') {
      rejectionReason = prompt('불합격 사유를 입력해주세요:')
      if (!rejectionReason || rejectionReason.trim() === '') {
        error('불합격 사유를 입력해야 합니다.')
        return
      }
    }

    try {
      const body: any = {
        stage,
        updated_by: profile.email
      }
      if (rejectionReason) {
        body.rejection_reason = rejectionReason
      }

      const res = await fetch(`/api/pipeline/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json()
        console.error('[updateStage] Failed:', errorData)
        error(`단계 변경 실패: ${errorData.error || '서버 오류'}`)
        return
      }

      // ✅ API 성공 시에만 state 업데이트
      console.log('[updateStage] Success:', { id, stage, rejectionReason })
      setPipeline(prev => prev.map(p => p.id === id ? { ...p, stage } : p))

      // 단계 변경 성공 시 모달 자동 닫기
      if (selected?.id === id) {
        setSelected(null)
      }
    } catch (err) {
      console.error('[updateStage] Error:', err)
      error('단계 변경 중 오류가 발생했습니다.')
    }
  }

  async function reanalyzePipeline(id: string) {
    if (!confirm('AI 매칭 분석을 백그라운드에서 수행합니다.\n완료되면 브라우저 알림으로 안내해드립니다.\n\n계속하시겠습니까?')) return

    const profile = await getProfile()
    if (!profile) {
      error('로그인이 필요합니다.')
      return
    }

    const targetPipeline = pipeline.find(p => p.id === id)
    if (!targetPipeline) {
      error('프로세스를 찾을 수 없습니다.')
      return
    }

    const jd = targetPipeline.job_descriptions
    const candidate = targetPipeline.candidates

    // 백그라운드 분석 시작 안내
    success('🔄 백그라운드에서 AI 매칭 분석을 시작합니다.\n완료되면 알림으로 안내해드립니다.')
    setReanalyzing(id) // 🔄 재분석 시작

    // 백그라운드 실행 (await 없이)
    ;(async () => {
      try {
        console.log('[Reanalyze] 📊 Step 1/3: JD와 후보자 데이터 준비 중...')
        console.log('[Reanalyze] 🤖 Step 2/3: AI 매칭 분석 중...')
        console.log('[Reanalyze] JD:', jd.position, '/ Candidate:', candidate.name)

        // AI 매칭 분석
        const matchRes = await fetch('/api/pipeline/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jd,
            candidate,
            client_comment: clientComment.trim() || undefined
          }),
        })

        if (!matchRes.ok) {
          const errorData = await matchRes.json().catch(() => ({ error: 'JSON 파싱 실패' }))
          console.error('[Reanalyze] ❌ Matching failed. Status:', matchRes.status)
          console.error('[Reanalyze] ❌ Error data:', JSON.stringify(errorData, null, 2))
          showNotification(
            '❌ AI 매칭 분석 실패',
            `${candidate.name} - ${jd.position} 매칭 분석에 실패했습니다.`
          )
          error(`❌ AI 매칭 분석 실패 (${matchRes.status})\n\n${errorData.error || '서버 오류가 발생했습니다.'}\n\n상세: ${errorData.details || '없음'}`)
          return
        }

        const matchData = await matchRes.json()
        console.log('[Reanalyze] ✅ Match score:', matchData.match_score)
        console.log('[Reanalyze] 💾 Step 3/3: 분석 결과 저장 중...')

        // 분석 결과로 업데이트
        const updateRes = await fetch(`/api/pipeline/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            match_score: matchData.match_score,
            match_reason: matchData.match_reason,
            skill_match_rate: matchData.skill_match_rate,
            experience_match: matchData.experience_match,
            strength_for_jd: matchData.strength_for_jd,
            concerns: matchData.concerns,
            updated_by: profile.email
          }),
        })

        if (!updateRes.ok) {
          const errorData = await updateRes.json()
          showNotification(
            '❌ 업데이트 실패',
            `${candidate.name} - ${jd.position} 결과 저장에 실패했습니다.`
          )
          error(`업데이트 실패: ${errorData.error || '서버 오류'}`)
          return
        }

        // 성공 시 목록 새로고침
        const params = new URLSearchParams({
          role: profile.role,
          user_email: profile.email,
          ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
          ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
        })
        const updated = await fetch(`/api/pipeline?${params}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }).then(r => r.json())
        setPipeline(updated.pipeline ?? [])

        // 모달이 열려있으면 선택된 항목도 업데이트
        if (selected?.id === id) {
          const updatedItem = updated.pipeline?.find((p: any) => p.id === id)
          if (updatedItem) setSelected(updatedItem)
        }

        // 브라우저 알림
        showNotification(
          '✅ AI 매칭 분석 완료!',
          `${candidate.name} - ${jd.position}\n매칭 점수: ${matchData.match_score}%`
        )
        success('✅ AI 매칭 분석이 완료되었습니다!')
        console.log('[Reanalyze] ✅ Success')
      } catch (e) {
        console.error('[Reanalyze] ❌ Error:', e)
        showNotification(
          '❌ 재분석 오류',
          '예상치 못한 오류가 발생했습니다.'
        )
        error('재분석 중 오류가 발생했습니다.')
      } finally {
        setReanalyzing(null) // 🔄 재분석 종료
      }
    })()
  }

  async function deletePipeline(id: string) {
    if (!confirm('프로세스에서 제거할까요?')) return

    const profile = await getProfile()
    if (!profile) {
      error('로그인이 필요합니다.')
      return
    }

    const params = new URLSearchParams({
      user_email: profile.email
    })

    const res = await fetch(`/api/pipeline/${id}?${params}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      error(data.error || '삭제 실패')
      return
    }

    setPipeline(prev => prev.filter(p => p.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  // is_active가 true인 활성 프로세스만 표시 (Candidates 페이지와 일관성 유지)
  const activePipeline = pipeline.filter(p => p.is_active)
  const groupedByStage = STAGES.map(stage => ({
    stage,
    items: activePipeline.filter(p => p.stage === stage)
  }))

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
          padding: '12px 20px',
          borderRadius: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          minWidth: 280,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text)'
        }}>
          <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
          <span>JD-후보자 매칭 분석 중... ({processingProgress}%)</span>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">채용 진행 현황</div>
          <div className="page-sub">총 {activePipeline.length}건 진행 중</div>

          {/* 안내 문구 */}
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'rgba(232, 255, 71, 0.1)',
            border: '1px solid rgba(232, 255, 71, 0.3)',
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--accent)',
            fontWeight: 500
          }}>
            ℹ️ 채용 프로세스 단계는 PM이 변경하여야 하며, 불합격의 경우 사유를 적어야 합니다!
          </div>
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
          {activePipeline.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => downloadPipelineAsCSV(activePipeline)}
              style={{ fontSize: 13 }}
            >
              📥 엑셀 다운로드
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ JD-후보자 매칭</button>
          <button className="btn btn-success" onClick={() => setShowManualAddModal(true)}>+ 후보자 추가</button>
        </div>
      </div>

      {loading ? (
        <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} /></div>
      ) : activePipeline.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔄</div>
          <div className="empty-text">진행 중인 프로세스가 없습니다</div>
          <div className="empty-sub">JD와 후보자를 매칭하여 채용을 시작하세요</div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div
            className="pipeline-scroll"
            style={{
              display: 'flex',
              gap: 4,
              overflowX: 'scroll',
              paddingBottom: 8
            }}>
            {groupedByStage.map(({ stage, items }) => (
            <div key={stage} style={{ minWidth: 200, flex: '0 0 auto' }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--muted2)',
                marginBottom: 12,
                padding: '6px 12px',
                background: 'var(--bg2)',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>{stage}</span>
                <span style={{ opacity: 0.6 }}>{items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }} className="pipeline-stage-items">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="card"
                    style={{ padding: 14, cursor: 'pointer' }}
                    onClick={() => setSelected(item)}
                  >
                    {/* 후보자 이름 - 최상단 강조 */}
                    <div style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#fff',
                      marginBottom: 8,
                      padding: '6px 10px',
                      background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
                      borderRadius: '6px',
                      border: '1px solid rgba(167, 139, 250, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <span>👤</span>
                      <span>{item.candidates.name}</span>
                      {item.candidates.source === 'Manual' && (
                        <span style={{
                          fontSize: 9,
                          padding: '2px 6px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: '#3b82f6',
                          borderRadius: 4,
                          fontWeight: 600
                        }}>
                          직접 입력
                        </span>
                      )}
                      {item.created_by_user && (
                        <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
                          추천: {item.created_by_user.full_name || item.created_by_user.email.split('@')[0]}
                        </span>
                      )}
                    </div>

                    {/* 회사명 */}
                    <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{item.job_descriptions.company ?? '회사명 미상'}</span>
                      {item.jd_owner_user && (
                        <span style={{ color: 'var(--muted)' }}>
                          (담당: {item.jd_owner_user.full_name || item.jd_owner_user.email.split('@')[0]})
                        </span>
                      )}
                    </div>

                    {/* 포지션 */}
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      {item.job_descriptions.position}
                    </div>
                    {item.match_score !== null && (
                      <div style={{
                        fontSize: 11,
                        color: item.match_score >= 80 ? 'var(--success)' : item.match_score >= 60 ? 'var(--warn)' : 'var(--muted2)',
                        marginBottom: 8
                      }}>
                        매칭: {item.match_score}점
                      </div>
                    )}
                    {item.next_action && (
                      <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        📌 {item.next_action}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
          {/* 우측 스크롤 힌트 */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 16,
            width: 80,
            background: 'linear-gradient(to left, var(--bg) 0%, transparent 100%)',
            pointerEvents: 'none'
          }} />
        </div>
      )}

      {/* 더 보기 버튼 */}
      {!loading && hasMorePipeline && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={loadMorePipeline}
            disabled={loadingMore}
            className="btn btn-secondary"
            style={{
              padding: '12px 32px',
              opacity: loadingMore ? 0.6 : 1,
              cursor: loadingMore ? 'not-allowed' : 'pointer'
            }}
          >
            {loadingMore ? '로딩 중...' : `더 보기 (${pipeline.length}개 표시 중)`}
          </button>
        </div>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4 }}>
                  {selected.job_descriptions.company ?? '회사명 미상'}
                  {selected.jd_owner_user && (
                    <span style={{ marginLeft: 4 }}>
                      (담당: {selected.jd_owner_user.full_name || selected.jd_owner_user.email.split('@')[0]})
                    </span>
                  )}
                  {' / '}{selected.job_descriptions.position}
                </div>
                <div className="modal-title">{selected.candidates.name}</div>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              <span className={`badge badge-${selected.stage}`}>{selected.stage}</span>
              {selected.match_score !== null && (
                <span className="badge badge-일반">매칭 {selected.match_score}점</span>
              )}
              {selected.created_by_user && (
                <span style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: 'rgba(136, 136, 128, 0.15)',
                  color: 'var(--muted)',
                  fontWeight: 500
                }}>
                  👤 추천: {selected.created_by_user.full_name || selected.created_by_user.email.split('@')[0]}
                </span>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">진행 단계</label>
              {(() => {
                // 권한 체크: Owner 또는 JD Owner만 변경 가능
                const canChangeStage = isOwner || userEmail === selected.job_descriptions.created_by

                if (canChangeStage) {
                  return (
                    <select
                      className="form-select"
                      value={selected.stage}
                      onChange={e => updateStage(selected.id, e.target.value)}
                    >
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )
                } else {
                  return (
                    <div style={{
                      padding: '10px 14px',
                      background: 'var(--bg3)',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontSize: 14
                    }}>
                      {selected.stage}
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        🔒 진행 단계는 JD 담당자만 변경할 수 있습니다
                      </div>
                    </div>
                  )
                }
              })()}
            </div>

            {selected.stage === '불합격' && (selected as any).rejection_reason && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">불합격 사유</div>
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(255, 107, 107, 0.1)',
                  border: '1px solid rgba(255, 107, 107, 0.3)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: 'var(--text)'
                }}>
                  {(selected as any).rejection_reason}
                </div>
              </div>
            )}

            {selected.match_reason && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">AI 매칭 분석</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{selected.match_reason}</div>
              </div>
            )}

            {selected.strength_for_jd?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">강점</div>
                <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selected.strength_for_jd.map((s, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--success)' }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {selected.concerns?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">우려사항</div>
                <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selected.concerns.map((c, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--warn)' }}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">클라이언트 코멘트 <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>(선택)</span></label>
              <textarea
                className="form-textarea"
                style={{ minHeight: 70, fontSize: 13 }}
                placeholder="예: 개발직군 채용 경험 필수, 스타트업 경험자 우대&#10;요건 완화/강화, 우선순위 변경, 기피 프로파일 등을 입력 후 재분석하세요."
                value={clientComment}
                onChange={(e) => setClientComment(e.target.value)}
              />
            </div>

            {/* 백그라운드 분석 안내 */}
            <div style={{
              marginBottom: 12,
              padding: '8px 12px',
              background: 'rgba(232, 255, 71, 0.1)',
              border: '1px solid rgba(232, 255, 71, 0.3)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent)' }}>💡 백그라운드 분석</div>
              <div>• 여러 후보자를 동시에 재분석할 수 있습니다</div>
              <div>• 분석 중에도 다른 작업이 가능합니다</div>
              <div>• 완료되면 브라우저 알림으로 안내해드립니다</div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button
                className="btn btn-primary"
                onClick={() => reanalyzePipeline(selected.id)}
                disabled={reanalyzing === selected.id}
                style={{ fontSize: 13, position: 'relative' }}
              >
                {reanalyzing === selected.id ? (
                  <>
                    <span style={{ opacity: 0.6 }}>⏳ AI 분석 중...</span>
                    <div style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 16,
                      height: 16,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  </>
                ) : (
                  '🔄 AI 재분석'
                )}
              </button>
              <button className="btn btn-danger" onClick={() => { deletePipeline(selected.id); setSelected(null) }}>
                프로세스에서 제거
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">프로세스에 추가</div>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">JD 선택</label>
              <select
                className="form-select"
                value={selectedJd}
                onChange={e => setSelectedJd(e.target.value)}
              >
                <option value="">JD를 선택하세요</option>
                {jds.filter(j => j.company).map(jd => (
                  <option key={jd.id} value={jd.id}>
                    {jd.company} - {jd.position}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">후보자 선택</label>
              <select
                className="form-select"
                value={selectedCandidate}
                onChange={e => setSelectedCandidate(e.target.value)}
              >
                <option value="">후보자를 선택하세요</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.current_company ?? '프리랜서'} / {c.current_position ?? '미상'})
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={addToPipeline}
              disabled={!selectedJd || !selectedCandidate || matching}
            >
              {matching ? <><div className="spinner" /> AI 매칭 분석 중...</> : '✅ 프로세스에 추가'}
            </button>
          </div>
        </div>
      )}

      {/* 수동 후보자 추가 모달 */}
      {showManualAddModal && (
        <div className="overlay" onClick={() => setShowManualAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">후보자 추가 (직접 입력)</div>
              <button className="modal-close" onClick={() => setShowManualAddModal(false)}>✕</button>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">JD 선택 *</label>
              <select
                className="form-select"
                value={manualForm.jd_id}
                onChange={e => setManualForm({ ...manualForm, jd_id: e.target.value })}
              >
                <option value="">JD를 선택하세요</option>
                {jds.filter(j => j.company).map(jd => (
                  <option key={jd.id} value={jd.id}>
                    {jd.company} - {jd.position}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">이름 *</label>
              <input
                className="form-input"
                placeholder="예: 홍길동"
                value={manualForm.name}
                onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
              />
            </div>

            <div className="form-row" style={{ marginBottom: 16, gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">이메일</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="예: example@example.com"
                  value={manualForm.email}
                  onChange={e => setManualForm({ ...manualForm, email: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">전화번호</label>
                <input
                  className="form-input"
                  placeholder="예: 010-1234-5678"
                  value={manualForm.phone}
                  onChange={e => setManualForm({ ...manualForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 16, gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">현재 회사</label>
                <input
                  className="form-input"
                  placeholder="예: 네이버"
                  value={manualForm.current_company}
                  onChange={e => setManualForm({ ...manualForm, current_company: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">최종학력</label>
                <input
                  className="form-input"
                  placeholder="예: 서울대학교 컴퓨터공학과 학사"
                  value={manualForm.education}
                  onChange={e => setManualForm({ ...manualForm, education: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">경력 년수</label>
              <input
                className="form-input"
                type="number"
                placeholder="예: 5"
                value={manualForm.total_experience_years}
                onChange={e => setManualForm({ ...manualForm, total_experience_years: e.target.value })}
              />
            </div>

            <div style={{ padding: 12, background: 'var(--info-bg)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--info)' }}>
              💡 직접 입력한 후보자는 AI 매칭 점수 없이 프로세스에 추가되며, "직접 입력" 뱃지가 표시됩니다.
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={addManualCandidate}
              disabled={!manualForm.jd_id || !manualForm.name || matching}
            >
              {matching ? <><div className="spinner" /> 추가 중...</> : '✅ 프로세스에 추가'}
            </button>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </main>
  )
}

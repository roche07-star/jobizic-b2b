'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { downloadPipelineAsCSV } from '@/lib/csv-export'

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

const STAGES = ['신규', '서류검토', '1차면접', '2차면접', '최종면접', '처우협의', '합격', '불합격']

interface Organization {
  id: string
  name: string
}

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<PipelineItem[]>([])
  const [jds, setJds] = useState<JD[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PipelineItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedJd, setSelectedJd] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [matching, setMatching] = useState(false)
  const [reanalyzing, setReanalyzing] = useState<string | null>(null) // 재분석 중인 pipeline ID
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('전체')

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
        fetch(`/api/pipeline?${params}`, fetchOptions).then(r => r.json()).then(d => setPipeline(d.pipeline ?? [])),
        fetch(`/api/jd?${params}`, fetchOptions).then(r => r.json()).then(d => setJds(d.jds ?? [])),
        fetch(`/api/candidates?${params}`, fetchOptions).then(r => r.json()).then(d => setCandidates(d.candidates ?? []))
      ]).finally(() => setLoading(false))
    }
    loadData()
  }, [selectedOrgId])

  async function addToPipeline() {
    if (!selectedJd || !selectedCandidate) return
    setMatching(true)

    try {
      // organization_id 가져오기
      const profile = await getProfile()
      if (!profile?.organization_id) {
        alert('조직 정보가 없습니다. 관리자에게 문의하세요.')
        setMatching(false)
        return
      }

      // AI 매칭 분석
      const jd = jds.find(j => j.id === selectedJd)
      const candidate = candidates.find(c => c.id === selectedCandidate)

      console.log('[Pipeline Add] Starting AI matching analysis...')
      const matchRes = await fetch('/api/pipeline/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, candidate }),
      })

      if (!matchRes.ok) {
        const errorData = await matchRes.json()
        console.error('[Pipeline Add] Matching analysis failed:', errorData)
        alert(`❌ AI 매칭 분석 실패\n\n${errorData.error || '서버 오류가 발생했습니다.'}\n\n프로세스 추가를 중단합니다.`)
        return
      }

      const matchData = await matchRes.json()
      console.log('[Pipeline Add] Matching analysis success. Score:', matchData.match_score)

      // 프로세스에 추가
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_id: selectedJd,
          candidate_id: selectedCandidate,
          stage: '신규',
          match_score: matchData.match_score,
          match_reason: matchData.match_reason,
          skill_match_rate: matchData.skill_match_rate,
          experience_match: matchData.experience_match,
          strength_for_jd: matchData.strength_for_jd,
          concerns: matchData.concerns,
          is_active: true,
          organization_id: profile.organization_id,
          created_by: profile.email,
        }),
      })

      if (res.ok) {
        // 새로고침 (파라미터 포함!)
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
        setShowAddModal(false)
        setSelectedJd('')
        setSelectedCandidate('')
        alert('✅ 채용 프로세스에 추가되었습니다!')
      } else {
        const err = await res.json()
        alert(err.error)
      }
    } catch (e) {
      alert('추가 중 오류가 발생했습니다.')
    } finally {
      setMatching(false)
    }
  }

  async function updateStage(id: string, stage: string) {
    const profile = await getProfile()
    if (!profile) {
      alert('로그인이 필요합니다.')
      return
    }

    // 불합격 단계일 경우 사유 필수 입력
    let rejectionReason: string | null = null
    if (stage === '불합격') {
      rejectionReason = prompt('불합격 사유를 입력해주세요:')
      if (!rejectionReason || rejectionReason.trim() === '') {
        alert('불합격 사유를 입력해야 합니다.')
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
        const error = await res.json()
        console.error('[updateStage] Failed:', error)
        alert(`단계 변경 실패: ${error.error || '서버 오류'}`)
        return
      }

      // ✅ API 성공 시에만 state 업데이트
      console.log('[updateStage] Success:', { id, stage, rejectionReason })
      setPipeline(prev => prev.map(p => p.id === id ? { ...p, stage } : p))

      // 단계 변경 성공 시 모달 자동 닫기
      if (selected?.id === id) {
        setSelected(null)
      }
    } catch (error) {
      console.error('[updateStage] Error:', error)
      alert('단계 변경 중 오류가 발생했습니다.')
    }
  }

  async function reanalyzePipeline(id: string) {
    if (!confirm('AI 매칭 분석을 다시 수행할까요?')) return

    const profile = await getProfile()
    if (!profile) {
      alert('로그인이 필요합니다.')
      return
    }

    const targetPipeline = pipeline.find(p => p.id === id)
    if (!targetPipeline) {
      alert('프로세스를 찾을 수 없습니다.')
      return
    }

    setReanalyzing(id) // 🔄 재분석 시작

    try {
      console.log('[Reanalyze] 📊 Step 1/3: JD와 후보자 데이터 준비 중...')

      // JD와 후보자 정보 가져오기
      const jd = targetPipeline.job_descriptions
      const candidate = targetPipeline.candidates

      console.log('[Reanalyze] 🤖 Step 2/3: AI 매칭 분석 중...')
      console.log('[Reanalyze] JD:', jd.position, '/ Candidate:', candidate.name)

      // AI 매칭 분석
      const matchRes = await fetch('/api/pipeline/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, candidate }),
      })

      if (!matchRes.ok) {
        const errorData = await matchRes.json()
        console.error('[Reanalyze] ❌ Matching failed:', errorData)
        alert(`❌ AI 매칭 분석 실패\n\n${errorData.error || '서버 오류가 발생했습니다.'}\n\n상세: ${errorData.details || '없음'}`)
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
        const error = await updateRes.json()
        alert(`업데이트 실패: ${error.error || '서버 오류'}`)
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

      alert('✅ AI 매칭 분석이 완료되었습니다!')
      console.log('[Reanalyze] ✅ Success')
    } catch (e) {
      console.error('[Reanalyze] ❌ Error:', e)
      alert('재분석 중 오류가 발생했습니다.')
    } finally {
      setReanalyzing(null) // 🔄 재분석 종료
    }
  }

  async function deletePipeline(id: string) {
    if (!confirm('프로세스에서 제거할까요?')) return

    const profile = await getProfile()
    if (!profile) {
      alert('로그인이 필요합니다.')
      return
    }

    const params = new URLSearchParams({
      user_email: profile.email
    })

    const res = await fetch(`/api/pipeline/${id}?${params}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || '삭제 실패')
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
      <div className="page-header">
        <div>
          <div className="page-title">채용 프로세스</div>
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
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ JD-후보자 추가</button>
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
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
          {groupedByStage.map(({ stage, items }) => (
            <div key={stage} style={{ minWidth: 280, flex: '0 0 auto' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(item => (
                  <div
                    key={item.id}
                    className="card"
                    style={{ padding: 14, cursor: 'pointer' }}
                    onClick={() => setSelected(item)}
                  >
                    <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{item.job_descriptions.company ?? '회사명 미상'}</span>
                      {item.jd_owner_user && (
                        <span style={{ color: 'var(--muted)' }}>
                          (담당: {item.jd_owner_user.full_name || item.jd_owner_user.email.split('@')[0]})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      {item.job_descriptions.position}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 8 }}>
                      👤 {item.candidates.name}
                      {item.created_by_user && (
                        <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>
                          (추천: {item.created_by_user.full_name || item.created_by_user.email.split('@')[0]})
                        </span>
                      )}
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
    </main>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ToastContainer'

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
  admin_comment: string | null
  job_descriptions: {
    id: string
    company: string
    position: string
    created_by: string
  }
  candidates: {
    id: string
    name: string
    email: string | null
    current_position: string | null
    total_experience_years: number | null
  }
  created_at: string
}

export default function AdminRecommendationsPage() {
  const { toasts, success, error, info, removeToast: onRemove } = useToast()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Recommendation | null>(null)
  const [sending, setSending] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'recommended' | 'all'>('pending')

  useEffect(() => {
    loadRecommendations()
  }, [statusFilter])

  async function loadRecommendations() {
    setLoading(true)
    try {
      const url = statusFilter === 'all'
        ? '/api/jd/recommendations'
        : `/api/jd/recommendations?status=${statusFilter}`

      const res = await fetch(url)
      const data = await res.json()

      if (res.ok) {
        setRecommendations(data.recommendations || [])
      }
    } catch (err) {
      console.error('[admin recommendations] Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function sendToPM(id: string) {
    if (sending) return

    setSending(true)

    try {
      const res = await fetch(`/api/jd/recommendations/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_comment: commentText.trim() || null })
      })

      if (!res.ok) {
        const data = await res.json()
        error(`❌ ${data.error || '전송 실패'}`)
        return
      }

      success('✅ PM에게 추천을 전송했습니다!')
      setSelected(null)
      setCommentText('')
      loadRecommendations()

    } catch (err) {
      console.error('[admin recommendations] Send error:', err)
      error('❌ 전송 중 오류가 발생했습니다.')
    } finally {
      setSending(false)
    }
  }

  // JD별로 그룹핑
  const groupedByJd = recommendations.reduce((acc, rec) => {
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
          <div className="page-title">후보자 추천 관리</div>
          <div className="page-sub">AI가 찾은 후보자를 검토하고 PM에게 추천하세요</div>
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <button
          className={`filter-btn${statusFilter === 'pending' ? ' active' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          대기중 {statusFilter === 'pending' && `(${recommendations.length})`}
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

      {loading ? (
        <div className="empty">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
        </div>
      ) : Object.keys(groupedByJd).length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <div className="empty-text">추천 대기중인 후보자가 없습니다</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          {Object.entries(groupedByJd).map(([jdId, group]) => (
            <div key={jdId} className="card">
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
                        background: 'var(--surface-secondary)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setSelected(rec)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            {rec.candidates.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {rec.candidates.current_position || '포지션 미상'}
                            {rec.candidates.total_experience_years && ` · ${rec.candidates.total_experience_years}년차`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span className="badge badge-일반">매칭 {rec.match_score}점</span>
                          <span className={`badge badge-${rec.recommendation === '추천' ? '활성' : '일반'}`}>
                            {rec.recommendation}
                          </span>
                          {rec.status === 'pending' && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelected(rec)
                              }}
                            >
                              PM에게 전송
                            </button>
                          )}
                          {rec.status === 'recommended' && (
                            <span className="badge badge-활성">전송완료</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상세 모달 */}
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
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  👨‍💼 {selected.candidates.name} ({selected.candidates.current_position || '포지션 미상'})
                  {selected.candidates.total_experience_years && ` · 경력 ${selected.candidates.total_experience_years}년`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  PM: {selected.recommended_to}
                </div>
              </div>

              {/* 매칭 점수 */}
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">매칭 점수</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span className="badge badge-일반" style={{ fontSize: 14 }}>
                    종합 {selected.match_score}점
                  </span>
                  <span className="badge badge-일반" style={{ fontSize: 14 }}>
                    스킬 {selected.skill_match_rate}점
                  </span>
                  <span className={`badge badge-${selected.recommendation === '추천' ? '활성' : '일반'}`} style={{ fontSize: 14 }}>
                    {selected.recommendation}
                  </span>
                </div>
              </div>

              {/* 매칭 근거 */}
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">매칭 근거</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{selected.match_reason}</div>
              </div>

              {/* 강점 */}
              {selected.strength_for_jd?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">이 JD에 대한 강점</div>
                  <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selected.strength_for_jd.map((s, i) => (
                      <li key={i} style={{ fontSize: 13, color: 'var(--success)' }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 우려사항 */}
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

              {/* 다음 단계 */}
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">다음 단계</div>
                <div style={{ fontSize: 13 }}>{selected.next_steps}</div>
              </div>

              {/* 경력 매칭 */}
              {selected.experience_match && (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">경력 적합도</div>
                  <div style={{ fontSize: 13 }}>{selected.experience_match}</div>
                </div>
              )}

              {selected.status === 'pending' && (
                <>
                  {/* 관리자 코멘트 입력 */}
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label">PM에게 전달할 코멘트 (선택)</div>
                    <textarea
                      className="form-textarea"
                      placeholder="추가 코멘트가 있으면 입력하세요"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      style={{ minHeight: 80 }}
                    />
                  </div>

                  {/* 전송 버튼 */}
                  <button
                    className="btn btn-primary"
                    onClick={() => sendToPM(selected.id)}
                    disabled={sending}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {sending ? '전송 중...' : '📤 PM에게 추천 전송'}
                  </button>
                </>
              )}

              {selected.status === 'recommended' && (
                <div style={{ padding: 12, background: 'var(--surface-secondary)', borderRadius: 6, textAlign: 'center' }}>
                  ✅ PM에게 전송 완료 ({new Date(selected.recommended_at!).toLocaleDateString('ko-KR')})
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

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
  recommended_at: string | null
  admin_comment: string | null
  job_descriptions: {
    id: string
    company: string
    position: string
  }
  candidates: {
    id: string
    name: string
    current_position: string | null
    total_experience_years: number | null
  }
  created_at: string
}

export default function RecommendationsPage() {
  const { toasts, success, error, info, removeToast: onRemove } = useToast()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Recommendation | null>(null)
  const [responding, setResponding] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'received' | 'manage'>('received')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (userRole) {
      loadRecommendations()
    }
  }, [userRole])

  async function checkAuth() {
    const profile = await getProfile()
    if (profile) {
      setUserRole(profile.role)
    }
  }

  async function loadRecommendations() {
    try {
      const res = await fetch('/api/jd/recommendations?status=recommended')
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

  async function respondToRecommendation(id: string, action: 'accept' | 'reject') {
    if (responding) return

    setResponding(true)

    try {
      const res = await fetch(`/api/jd/recommendations/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, pm_comment: commentText.trim() || null })
      })

      const data = await res.json()

      if (!res.ok) {
        error(`❌ ${data.error || '처리 실패'}`)
        return
      }

      success(data.message || '✅ 처리되었습니다.')
      setSelected(null)
      setCommentText('')
      loadRecommendations()

    } catch (err) {
      console.error('[recommendations] Respond error:', err)
      error('❌ 처리 중 오류가 발생했습니다.')
    } finally {
      setResponding(false)
    }
  }

  return (
    <main className="page">
      <ToastContainer toasts={toasts} onRemove={onRemove} />

      <div className="page-header">
        <div>
          <div className="page-title">추천</div>
          <div className="page-sub">
            {userRole === 'admin'
              ? 'AI 후보 추천 관리 및 내가 받은 추천을 확인하세요'
              : '관리자가 추천한 후보자를 확인하고 수락/거절하세요'}
          </div>
        </div>
      </div>

      {/* Super Admin 탭 */}
      {userRole === 'admin' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button
            className={`btn${activeTab === 'manage' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setActiveTab('manage')}
          >
            후보자 추천 관리
          </button>
          <button
            className={`btn${activeTab === 'received' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setActiveTab('received')}
          >
            내가 받은 추천
          </button>
        </div>
      )}

      {/* 후보자 추천 관리 탭 */}
      {activeTab === 'manage' ? (
        <div style={{
          padding: 20,
          background: 'var(--surface)',
          borderRadius: 8,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            후보자 추천 관리
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Super Admin 전용 기능입니다
          </div>
          <a href="/admin/recommendations" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary">
              후보자 추천 관리 페이지로 이동
            </button>
          </a>
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
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected(rec)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                    {rec.job_descriptions.company} - {rec.job_descriptions.position}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    👨‍💼 {rec.candidates.name} ({rec.candidates.current_position || '포지션 미상'})
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="badge badge-일반">매칭 {rec.match_score}점</span>
                  <span className={`badge badge-${rec.recommendation === '추천' ? '활성' : '일반'}`}>
                    {rec.recommendation}
                  </span>
                </div>
              </div>

              {rec.admin_comment && (
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--surface-secondary)',
                  borderRadius: 6,
                  fontSize: 13,
                  marginBottom: 8
                }}>
                  💬 관리자: {rec.admin_comment}
                </div>
              )}

              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                추천일: {new Date(rec.recommended_at!).toLocaleDateString('ko-KR')}
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
              <div className="modal-title">후보자 추천 상세</div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ padding: 24 }}>
              {/* JD & 후보자 정보 */}
              <div style={{ marginBottom: 20, padding: 16, background: 'var(--surface-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                  {selected.job_descriptions.company} - {selected.job_descriptions.position}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  👨‍💼 {selected.candidates.name} ({selected.candidates.current_position || '포지션 미상'})
                  {selected.candidates.total_experience_years && ` · 경력 ${selected.candidates.total_experience_years}년`}
                </div>
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
                  <span className={`badge badge-${selected.recommendation === '추천' ? '활성' : '일반'}`} style={{ fontSize: 14 }}>
                    {selected.recommendation}
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
                  <div className="form-label">이 JD에 대한 강점</div>
                  <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selected.strength_for_jd.map((s, i) => (
                      <li key={i} style={{ fontSize: 13, color: 'var(--success)' }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 관리자 코멘트 */}
              {selected.admin_comment && (
                <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface-secondary)', borderRadius: 6 }}>
                  <div className="form-label">관리자 코멘트</div>
                  <div style={{ fontSize: 13 }}>{selected.admin_comment}</div>
                </div>
              )}

              {/* PM 코멘트 입력 */}
              <div style={{ marginBottom: 20 }}>
                <div className="form-label">응답 코멘트 (선택)</div>
                <textarea
                  className="form-textarea"
                  placeholder="수락/거절 사유를 입력하세요 (선택)"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  style={{ minHeight: 80 }}
                />
              </div>

              {/* 액션 버튼 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-success"
                  onClick={() => respondToRecommendation(selected.id, 'accept')}
                  disabled={responding}
                  style={{ flex: 1 }}
                >
                  {responding ? '처리 중...' : '✅ 수락하고 파이프라인 추가'}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => respondToRecommendation(selected.id, 'reject')}
                  disabled={responding}
                  style={{ flex: 1 }}
                >
                  {responding ? '처리 중...' : '❌ 거절'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

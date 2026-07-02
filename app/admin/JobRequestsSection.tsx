'use client'

import { useState, useEffect } from 'react'

interface JobRequest {
  id: string
  name: string
  email: string
  phone: string | null
  position: string
  message: string
  adam_user_email: string
  adam_application_id: string
  adam_analysis_id: string | null
  adam_analysis_data: any
  status: 'pending' | 'saved' | 'rejected'
  candidate_id: string | null
  created_at: string
}

export default function JobRequestsSection() {
  const [requests, setRequests] = useState<JobRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    try {
      const res = await fetch('/api/admin/job-requests?status=pending')
      const data = await res.json()
      setRequests(data.requests || [])
    } catch (error) {
      console.error('구직 요청 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveToCandidate(requestId: string) {
    if (!confirm('이 구직자를 후보자로 저장하시겠습니까?')) return

    setSaving(requestId)
    try {
      const res = await fetch(`/api/admin/job-requests/${requestId}/save-to-candidate`, {
        method: 'POST'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '후보자 저장 실패')
      }

      alert('✅ ' + data.message)

      // 목록에서 제거
      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (error: any) {
      alert('❌ ' + error.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">구직자 관리</div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted2)' }}>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-title">
        구직자 관리 ({requests.length})
      </div>

      {requests.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted2)' }}>
          대기 중인 구직 요청이 없습니다.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>이름</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>이메일</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>포지션</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>메시지</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>요청일</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(request => (
                <tr key={request.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>
                    <div style={{ fontWeight: 600 }}>{request.name}</div>
                    {request.phone && (
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{request.phone}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted2)' }}>
                    {request.email}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500 }}>
                    {request.position}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, maxWidth: 300 }}>
                    <div style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'var(--text)'
                    }}>
                      {request.message}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted2)' }}>
                    {new Date(request.created_at).toLocaleDateString('ko-KR', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => saveToCandidate(request.id)}
                      disabled={!!saving}
                      style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                    >
                      {saving === request.id ? '저장 중...' : '후보자 저장'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

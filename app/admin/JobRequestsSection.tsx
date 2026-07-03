'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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

// Supabase 클라이언트 생성
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function JobRequestsSection() {
  const [requests, setRequests] = useState<JobRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadRequests()

    // 브라우저 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Supabase Realtime 구독
    const channel = supabase
      .channel('job-requests-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_requests',
          filter: 'status=eq.pending'
        },
        (payload: any) => {
          console.log('🔔 새 구직 요청:', payload)

          // 알림 표시
          if ('Notification' in window && Notification.permission === 'granted') {
            const request = payload.new as JobRequest
            new Notification('🔴 새 구직 요청!', {
              body: `${request.name} - ${request.position}`,
              icon: '/icon.png',
              badge: '/badge.png',
              tag: request.id,
              requireInteraction: true
            })
          }

          // 목록 새로고침
          loadRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
        const errorMsg = data.details
          ? `${data.error}\n\n상세: ${data.details}\n코드: ${data.code || 'N/A'}`
          : data.error || '후보자 저장 실패'
        throw new Error(errorMsg)
      }

      alert('✅ ' + data.message)

      // 목록에서 제거
      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (error: any) {
      console.error('후보자 저장 에러:', error)
      alert('❌ ' + error.message)
    } finally {
      setSaving(null)
    }
  }

  async function deleteRequest(requestId: string) {
    if (!confirm('이 구직 요청을 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/admin/job-requests/${requestId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '삭제 실패')
      }

      alert('✅ 구직 요청이 삭제되었습니다')

      // 목록에서 제거
      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (error: any) {
      alert('❌ ' + error.message)
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
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>포지션</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>메시지</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(request => (
                <tr key={request.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>
                    {request.name}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500 }}>
                    {request.position}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    {request.message}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => saveToCandidate(request.id)}
                        disabled={!!saving}
                        style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                      >
                        {saving === request.id ? '저장 중...' : '후보자 저장'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteRequest(request.id)}
                        disabled={!!saving}
                        style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                      >
                        삭제
                      </button>
                    </div>
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

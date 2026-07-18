'use client'

import { useEffect, useState } from 'react'

export default function GlobalJobProgress() {
  const [job, setJob] = useState<any>(null)

  useEffect(() => {
    // localStorage에서 진행 중인 job 확인
    const checkJob = async () => {
      const jobId = localStorage.getItem('processing_job_id')
      if (!jobId) {
        setJob(null)
        return
      }

      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        const data = await res.json()

        if (data.status === 'completed' || data.status === 'failed') {
          // 완료되면 localStorage에서 제거
          localStorage.removeItem('processing_job_id')
          setJob(null)

          if (data.status === 'completed') {
            // 완료 알림
            alert('✅ 이력서 분석이 완료되었습니다!')
          } else {
            alert('❌ 분석 실패: ' + (data.error || '알 수 없는 오류'))
          }
        } else {
          setJob(data)
        }
      } catch (err) {
        console.error('[GlobalJobProgress] Error:', err)
      }
    }

    // 초기 체크
    checkJob()

    // 2초마다 polling
    const interval = setInterval(checkJob, 2000)

    return () => clearInterval(interval)
  }, [])

  if (!job) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)',
      color: 'white',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 9999,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      {/* 스피너 */}
      <div style={{
        width: '20px',
        height: '20px',
        border: '3px solid rgba(255,255,255,0.3)',
        borderTop: '3px solid white',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />

      {/* 메시지 */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>
          {job.message || '처리 중...'}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.9 }}>
          진행률: {job.progress}%
        </div>
      </div>

      {/* 진행 바 */}
      <div style={{
        width: '200px',
        height: '8px',
        background: 'rgba(255,255,255,0.2)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${job.progress}%`,
          height: '100%',
          background: 'white',
          transition: 'width 0.3s ease',
        }} />
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

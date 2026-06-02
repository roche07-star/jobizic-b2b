'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getProfile } from '@/lib/auth'

interface JD {
  id: string
  company: string | null
  position: string
  priority: string
  status: string
  created_at: string
}

interface Stats {
  totalJDs: number
  totalCandidates: number
  thisMonthMatches: number
  activePipelines: number
}

interface Organization {
  id: string
  name: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalJDs: 0,
    totalCandidates: 0,
    thisMonthMatches: 0,
    activePipelines: 0,
  })
  const [recentJDs, setRecentJDs] = useState<JD[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('전체')

  useEffect(() => {
    async function loadOrganizations() {
      const profile = await getProfile()
      if (!profile) return

      setIsAdmin(profile.role === 'admin')

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
        ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
        ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
      })

      Promise.all([
        fetch(`/api/jd?${params}`).then(r => r.json()),
        fetch(`/api/candidates?${params}`).then(r => r.json()),
        fetch(`/api/pipeline?${params}`).then(r => r.json()),
      ]).then(([jdData, candidateData, pipelineData]) => {
        const jds = jdData.jds ?? []
        const candidates = candidateData.candidates ?? []
        const pipeline = pipelineData.pipeline ?? []

        // 이번 달 매칭 계산
        const now = new Date()
        const thisMonth = pipeline.filter((p: any) => {
          const created = new Date(p.created_at)
          return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
        }).length

        setStats({
          totalJDs: jds.length,
          totalCandidates: candidates.length,
          thisMonthMatches: thisMonth,
          activePipelines: pipeline.filter((p: any) => p.is_active).length,
        })

        setRecentJDs(jds.slice(0, 5))
      }).finally(() => setLoading(false))
    }
    loadData()
  }, [selectedOrgId])

  const statsData = [
    { label: '등록된 JD', value: loading ? '—' : stats.totalJDs.toString() },
    { label: '후보자 DB', value: loading ? '—' : stats.totalCandidates.toString() },
    { label: '이번 달 매칭', value: loading ? '—' : stats.thisMonthMatches.toString() },
    { label: '진행 중', value: loading ? '—' : stats.activePipelines.toString() },
  ]

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-title">대시보드</div>
          <div className="page-sub">Jobizic B2B — AI 헤드헌터 플랫폼</div>
        </div>
        {isAdmin && organizations.length > 0 && (
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-2)',
              color: 'var(--text)',
              fontSize: 13
            }}
          >
            <option value="전체">전체 조직</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="stats-grid">
        {statsData.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-title">빠른 시작</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/jd/new">
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                📋 JD 입력 / AI 파싱
              </button>
            </Link>
            <Link href="/candidates/new">
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
                👤 후보자 등록
              </button>
            </Link>
            <Link href="/pipeline">
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
                🔄 채용 파이프라인
              </button>
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-title">최근 JD</div>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : recentJDs.length === 0 ? (
            <div className="empty" style={{ padding: '24px' }}>
              <div className="empty-sub">아직 등록된 JD가 없습니다</div>
              <Link href="/jd/new">
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>JD 등록하기 →</button>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentJDs.map(jd => (
                <Link key={jd.id} href={`/jd`}>
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--bg3)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg3)'}
                  >
                    <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 2 }}>
                      {jd.company ?? '회사명 미상'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                      {jd.position}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span className={`badge badge-${jd.priority}`} style={{ fontSize: 10 }}>{jd.priority}</span>
                      <span className={`badge badge-${jd.status}`} style={{ fontSize: 10 }}>{jd.status}</span>
                    </div>
                  </div>
                </Link>
              ))}
              <Link href="/jd">
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                  전체 JD 보기 →
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

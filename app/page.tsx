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

interface MemberStat {
  id: string
  name: string
  email: string
  role: string
  jdCount: number
  candidateCount: number
  pipelineCount: number
  activePipelineCount: number
}

interface DashboardStats {
  memberStats: MemberStat[]
  jdByStatus: {
    active: number
    closed: number
    hold: number
  }
  pipelineByStage: Record<string, number>
  totals: {
    members: number
    jds: number
    candidates: number
    pipelines: number
    activePipelines: number
  }
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
  const [isOwnerOrPM, setIsOwnerOrPM] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('전체')
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    async function loadOrganizations() {
      const profile = await getProfile()
      if (!profile) return

      setIsAdmin(profile.role === 'admin')
      setIsOwnerOrPM(profile.role === 'owner' || profile.role === 'headhunter')

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

        // Owner/PM인 경우 추가 통계 로드
        if (profile.role === 'owner' || profile.role === 'headhunter') {
          const statsParams = new URLSearchParams({
            role: profile.role,
            organization_id: profile.organization_id || '',
          })
          fetch(`/api/dashboard/stats?${statsParams}`)
            .then(r => r.json())
            .then(data => setDashboardStats(data))
            .catch(err => console.error('Failed to load dashboard stats:', err))
        }
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
                🔄 채용 프로세스
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

      {/* Owner/PM 전용: 팀 통계 */}
      {isOwnerOrPM && dashboardStats && (
        <>
          {/* 멤버별 활동 통계 */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-title">팀 멤버 활동 현황</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, color: 'var(--muted2)', fontWeight: 600 }}>멤버</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, color: 'var(--muted2)', fontWeight: 600 }}>역할</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, color: 'var(--muted2)', fontWeight: 600 }}>담당 JD</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, color: 'var(--muted2)', fontWeight: 600 }}>담당 후보자</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, color: 'var(--muted2)', fontWeight: 600 }}>파이프라인</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, color: 'var(--muted2)', fontWeight: 600 }}>진행 중</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardStats.memberStats.map(member => (
                    <tr key={member.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{member.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{member.email}</div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className="badge" style={{ fontSize: 11 }}>
                          {member.role === 'owner' ? '오너' : member.role === 'headhunter' ? 'PM' : member.role === 'searcher' ? 'Searcher' : member.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{member.jdCount}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{member.candidateCount}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{member.pipelineCount}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{member.activePipelineCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* JD & 파이프라인 현황 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
            {/* JD 상태별 */}
            <div className="card">
              <div className="card-title">JD 현황</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>활성</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{dashboardStats.jdByStatus.active}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b7280' }} />
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>완료</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{dashboardStats.jdByStatus.closed}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>보류</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{dashboardStats.jdByStatus.hold}</span>
                </div>
              </div>
            </div>

            {/* 파이프라인 단계별 */}
            <div className="card">
              <div className="card-title">파이프라인 단계별</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {Object.entries(dashboardStats.pipelineByStage)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 5)
                  .map(([stage, count]) => (
                    <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: '0 0 80px', fontSize: 12, color: 'var(--muted)' }}>{stage}</div>
                      <div style={{ flex: 1, height: 20, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, ((count as number) / dashboardStats.totals.pipelines) * 100)}%`,
                            background: 'var(--accent)',
                            transition: 'width 0.3s'
                          }}
                        />
                      </div>
                      <div style={{ flex: '0 0 30px', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{count}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}

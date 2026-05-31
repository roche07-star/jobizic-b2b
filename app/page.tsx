import Link from 'next/link'

export default function Dashboard() {
  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-title">대시보드</div>
          <div className="page-sub">Jobizic B2B — AI 헤드헌터 플랫폼</div>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: '등록된 JD', value: '—' },
          { label: '후보자 DB', value: '—' },
          { label: '이번 달 매칭', value: '—' },
          { label: '진행 중 후보자', value: '—' },
        ].map(s => (
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
            <Link href="/candidates">
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
                👤 후보자 검색
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
          <div className="empty" style={{ padding: '24px' }}>
            <div className="empty-sub">아직 등록된 JD가 없습니다</div>
            <Link href="/jd/new">
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>JD 등록하기 →</button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

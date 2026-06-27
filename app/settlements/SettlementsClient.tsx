'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Settlement {
  id: string
  candidate_name: string
  company?: string
  position?: string
  start_date: string
  salary: number
  commission_rate: number
  incentive_rate: number
  personal_override: number
  memo?: string
  year: number
  my_role?: 'PM_SOLO' | 'PM' | 'SEARCHER' // 나의 역할
  partner_name?: string // 파트너 이름
  my_ratio?: number // 내 비율 (%)
}

export default function SettlementsClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [years, setYears] = useState([2025, 2026]) // 2025년, 2026년
  const [editingId, setEditingId] = useState<string | null>(null)
  const [goalAmount, setGoalAmount] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('settlements_goalAmount')
      return saved ? parseInt(saved) : 5000
    }
    return 5000
  })
  const [carryover, setCarryover] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('settlements_carryover')
      return saved ? parseInt(saved) : 0
    }
    return 0
  })
  const [editingGoal, setEditingGoal] = useState(false)
  const [editingCarryover, setEditingCarryover] = useState(false)
  const [tempGoal, setTempGoal] = useState('')
  const [tempCarryover, setTempCarryover] = useState('')
  const [formData, setFormData] = useState({
    candidate_name: '',
    company: '',
    position: '',
    start_date: '',
    salary: 0,
    commission_rate: 17,
    incentive_rate: 70,
    personal_override: 0,
    memo: '',
    my_role: 'PM' as 'PM_SOLO' | 'PM' | 'SEARCHER', // 기본 PM
    partner_name: '',
    my_ratio: 50, // 기본 50%
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.userType !== 'HEADHUNTER') {
      alert('헤드헌터 전용 기능입니다.')
      router.push('/')
      return
    }
    if (session.user.plan === 'FREE') {
      alert('PRO 이상 플랜이 필요합니다.')
      router.push('/pricing')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user.userType === 'HEADHUNTER') {
      loadSettlements()
    }
  }, [selectedYear, session])

  const loadSettlements = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/settlements?year=${selectedYear}`)
      const data = await res.json()
      if (res.ok) {
        setSettlements(data.settlements || [])
      } else {
        alert(data.error || '조회 실패')
      }
    } catch (err) {
      alert('서버 연결 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.candidate_name || !formData.start_date || !formData.salary) {
      alert('필수 항목을 입력해주세요.')
      return
    }

    // 입사일의 연도가 선택된 연도와 일치하는지 확인
    const startYear = new Date(formData.start_date).getFullYear()
    if (startYear !== selectedYear) {
      alert(`입사일의 연도(${startYear}년)가 선택된 연도(${selectedYear}년)와 일치하지 않습니다.\n입사일을 ${selectedYear}년으로 입력해주세요.`)
      return
    }

    try {
      const url = editingId ? `/api/settlements/${editingId}` : '/api/settlements'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (res.ok) {
        alert(editingId ? '수정되었습니다.' : '등록되었습니다.')
        setShowForm(false)
        setEditingId(null)
        resetForm()
        loadSettlements()
      } else {
        alert(data.error || '실패')
      }
    } catch (err) {
      alert('서버 연결 실패')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/settlements/${id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('삭제되었습니다.')
        loadSettlements()
      } else {
        const data = await res.json()
        alert(data.error || '삭제 실패')
      }
    } catch (err) {
      alert('서버 연결 실패')
    }
  }

  const startEdit = (s: Settlement) => {
    setFormData({
      candidate_name: s.candidate_name,
      company: s.company || '',
      position: s.position || '',
      start_date: s.start_date,
      salary: s.salary,
      commission_rate: s.commission_rate,
      incentive_rate: s.incentive_rate,
      personal_override: s.personal_override,
      memo: s.memo || '',
      my_role: s.my_role || 'PM',
      partner_name: s.partner_name || '',
      my_ratio: s.my_ratio || 50,
    })
    setEditingId(s.id)
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      candidate_name: '',
      company: '',
      position: '',
      start_date: '',
      salary: 0,
      commission_rate: 17,
      incentive_rate: 70,
      personal_override: 0,
      memo: '',
      my_role: 'PM',
      partner_name: '',
      my_ratio: 50,
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const f = (n: number) => Math.round(n * 100) / 100

  const calculateCommission = (salary: number, rate: number) => f(salary * (rate / 100))
  // 개인 매출액 계산: 실매출액 × my_ratio
  const calculatePersonalCommission = (commission: number, myRatio: number) => f(commission * (myRatio / 100))

  const stats = (() => {
    let totalSales = 0, totalPersonal = 0, totalIncentive = 0, totalTax = 0, totalNet = 0, rateSum = 0, rateCount = 0
    let cumPersonal = 0
    const threshold = goalAmount

    settlements.forEach((s, idx) => {
      const sales = calculateCommission(s.salary, s.commission_rate) // 실매출액
      const myRatio = s.my_ratio || 50 // 내 비율
      const personal = calculatePersonalCommission(sales, myRatio) // 개인 매출액 (실매출액 × my_ratio)
      const ir = threshold > 0 && cumPersonal >= threshold ? 100 : s.incentive_rate
      const incentive = f(personal * ir / 100) // 인센티브 (개인 매출액 × 요율)
      cumPersonal += personal
      const tax = f(incentive * 0.033)
      const net = f(incentive - tax)

      totalSales += sales
      totalPersonal += personal
      totalIncentive += incentive
      totalTax += tax
      totalNet += net
      if (s.commission_rate > 0) {
        rateSum += s.commission_rate
        rateCount++
      }
    })

    const avgRate = rateCount > 0 ? rateSum / rateCount : 0
    return { totalSales: f(totalSales), totalPersonal: f(totalPersonal), totalIncentive: f(totalIncentive), totalTax: f(totalTax), totalNet: f(totalNet), avgRate: f(avgRate) }
  })()

  const threshold = goalAmount + carryover
  const achievementRate = threshold > 0 ? Math.min(Math.round((stats.totalPersonal / threshold) * 100), 100) : 0
  const remaining = Math.max(threshold - stats.totalPersonal, 0)

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f1e8' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-yellow-700 border-t-transparent"></div>
          <p className="mt-4" style={{ color: '#78716c' }}>로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f1e8', padding: '24px' }}>
      <div className="mx-auto" style={{ maxWidth: '1600px' }}>
        {/* 뒤로가기 버튼 */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => router.push('/analyze')}
            style={{
              padding: '8px 16px',
              background: '#e7e5e4',
              color: '#1c1917',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← 뒤로가기
          </button>
        </div>

        {/* 연도 탭 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
          {years.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              style={{
                padding: '8px 28px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                background: selectedYear === year ? '#b8860b' : '#e7e5e4',
                color: selectedYear === year ? '#1c1917' : '#78716c'
              }}
            >
              {year}년
            </button>
          ))}
          <button
            onClick={() => {
              const maxYear = Math.max(...years)
              const nextYear = maxYear + 1
              setYears(prev => [...prev, nextYear])
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px dashed #d6d3d1',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '16px',
              background: 'transparent',
              color: '#a8a29e'
            }}
            title="연도 추가"
          >
            +
          </button>
        </div>

        {/* 진행바 */}
        {settlements.length > 0 && (
          <div style={{ background: '#e8e1d3', border: '1px solid #d6d3d1', borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#b8860b', fontWeight: 700 }}>💡 전환액 (개인매출액 기준)</span>
            {editingGoal ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  autoFocus
                  value={tempGoal}
                  onChange={e => setTempGoal(e.target.value)}
                  style={{ width: '100px', padding: '4px 8px', border: '1px solid #b8860b', borderRadius: '6px', fontSize: '13px' }}
                />
                <span style={{ fontSize: '12px', color: '#78716c' }}>만원</span>
                <button
                  onClick={() => {
                    const newGoal = parseInt(tempGoal) || 0
                    setGoalAmount(newGoal)
                    localStorage.setItem('settlements_goalAmount', String(newGoal))
                    setEditingGoal(false)
                  }}
                  style={{ fontSize: '11px', padding: '4px 12px', background: '#b8860b', color: '#1c1917', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  저장
                </button>
                <button
                  onClick={() => setEditingGoal(false)}
                  style={{ fontSize: '11px', padding: '4px 8px', background: '#e7e5e4', color: '#1c1917', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            ) : (
              <>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#1c1917' }}>
                  {goalAmount.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 400 }}>만원</span>
                </span>
                <button
                  onClick={() => {
                    setTempGoal(String(goalAmount))
                    setEditingGoal(true)
                  }}
                  style={{ fontSize: '11px', padding: '3px 10px', background: '#d4c5a9', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#6b5d47' }}
                >
                  수정
                </button>
              </>
            )}
            <span style={{ fontSize: '12px', color: '#78716c', marginLeft: '8px' }}>미수금:</span>
            {editingCarryover ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="number"
                  autoFocus
                  value={tempCarryover}
                  onChange={e => setTempCarryover(e.target.value)}
                  placeholder="만원"
                  style={{ width: '80px', padding: '4px 8px', border: '1px solid #3b82f6', borderRadius: '6px', fontSize: '12px' }}
                />
                <button
                  onClick={() => {
                    const newCarryover = parseInt(tempCarryover) || 0
                    setCarryover(newCarryover)
                    localStorage.setItem('settlements_carryover', String(newCarryover))
                    setEditingCarryover(false)
                  }}
                  style={{ fontSize: '11px', padding: '4px 10px', background: '#3b82f6', color: '#1c1917', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditingCarryover(false)
                    setTempCarryover('')
                  }}
                  style={{ fontSize: '11px', padding: '4px 8px', background: '#e7e5e4', color: '#1c1917', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempCarryover(String(carryover || ''))
                  setEditingCarryover(true)
                }}
                style={{
                  fontSize: '11px',
                  padding: '3px 10px',
                  background: carryover > 0 ? '#dbeafe' : '#f5f5f4',
                  border: `1px solid ${carryover > 0 ? '#3b82f6' : '#d6d3d1'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: carryover > 0 ? '#3b82f6' : '#a8a29e',
                  fontWeight: carryover > 0 ? 700 : 400
                }}
              >
                {carryover > 0 ? `${carryover.toLocaleString()}만원 ✎` : '+ 추가'}
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#78716c' }}>
                {achievementRate}% 달성 {remaining > 0 && <span style={{ color: '#dc2626', marginLeft: '4px' }}>({remaining.toLocaleString()}만원 남음)</span>}
              </span>
              <div style={{ width: '200px', height: '8px', background: '#d4c5a9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${achievementRate}%`, height: '100%', background: '#b8860b', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        )}

        {/* 통계 카드 */}
        {settlements.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: '총 실매출액', val: `${stats.totalSales.toLocaleString()} 만원`, sub: `${settlements.length}건 합산`, color: '#b8860b' },
              { label: '개인 매출액', val: `${stats.totalPersonal.toLocaleString()} 만원`, sub: '내 몫 합계', color: '#3b82f6' },
              { label: '총 인센티브 (실수령)', val: `${stats.totalNet.toLocaleString()} 만원`, sub: `세전 ${stats.totalIncentive.toLocaleString()} · 세금 ${stats.totalTax.toLocaleString()}`, color: '#22c55e' },
              { label: '평균 수수료율', val: `${stats.avgRate.toFixed(1)}%`, sub: '전체 평균', color: '#1c1917' },
            ].map(({ label, val, sub, color }) => (
              <div key={label} style={{ background: '#fff', border: '1px solid #d6d3d1', borderRadius: '12px', padding: '16px 18px' }}>
                <div style={{ fontSize: '10px', color: '#a8a29e', marginBottom: '6px' }}>{label}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color }}>{val}</div>
                <div style={{ fontSize: '10px', color: '#a8a29e', marginTop: '4px' }}>{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#1c1917' }}>정산 내역</div>
          <button
            onClick={() => setShowForm(p => !p)}
            style={{ padding: '8px 20px', background: '#b8860b', color: '#1c1917', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          >
            {showForm ? '✕ 닫기' : '+ 정산 추가'}
          </button>
        </div>

        {/* 등록 폼 */}
        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #b8860b', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <form onSubmit={handleSubmit}>
              {/* 역할 선택 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#a8a29e', display: 'block', marginBottom: '8px' }}>나의 역할 *</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[
                    ['PM 단독', 'PM_SOLO'],
                    ['PM (파트너와)', 'PM'],
                    ['써처 (파트너와)', 'SEARCHER'],
                  ].map(([label, value]) => (
                    <label
                      key={value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: formData.my_role === value ? '2px solid #b8860b' : '2px solid #e7e5e4',
                        background: formData.my_role === value ? '#fef3c7' : '#fff',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="radio"
                        name="my_role"
                        value={value}
                        checked={formData.my_role === value}
                        onChange={e => setFormData(p => ({ ...p, my_role: e.target.value as 'PM_SOLO' | 'PM' | 'SEARCHER', my_ratio: e.target.value === 'PM_SOLO' ? 100 : 50 }))}
                        style={{
                          cursor: 'pointer',
                          width: '18px',
                          height: '18px',
                          accentColor: '#b8860b'
                        }}
                      />
                      <span style={{
                        fontSize: '13px',
                        fontWeight: formData.my_role === value ? 700 : 500,
                        color: '#1c1917'
                      }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', alignItems: 'end' }}>
                {[
                  ['합격자 *', 'candidate_name', 'text', '홍길동'],
                  ['입사일', 'start_date', 'date', ''],
                  ['연봉(만)', 'salary', 'number', '5000'],
                  ['수수료율%', 'commission_rate', 'number', '17'],
                  ...(formData.my_role !== 'PM_SOLO' ? [['파트너 이름', 'partner_name', 'text', '파트너 이름']] : []),
                  ...(formData.my_role !== 'PM_SOLO' ? [['내 비율(%)', 'my_ratio', 'number', '50']] : []),
                  ['고객사', 'company', 'text', '삼성전자'],
                  ['포지션', 'position', 'text', '백엔드 개발'],
                  ['요율%', 'incentive_rate', 'number', '70'],
                ].map(([label, key, type, ph]) => (
                  <div key={key}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#a8a29e', display: 'block', marginBottom: '5px' }}>{label}</label>
                    <input
                      type={type}
                      value={type === 'number' ? (formData[key as keyof typeof formData] || '') : formData[key as keyof typeof formData]}
                      onChange={e => setFormData(p => ({ ...p, [key]: type === 'number' ? (e.target.value === '' ? 0 : parseInt(e.target.value) || 0) : e.target.value }))}
                      placeholder={ph}
                      style={{ width: '100%', padding: '7px 8px', border: '1px solid #d6d3d1', borderRadius: '7px', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
              {formData.salary && formData.commission_rate && (
                <div style={{ fontSize: '11px', color: '#b8860b', fontWeight: 700, marginTop: '10px' }}>
                  {(() => {
                    const sales = calculateCommission(formData.salary, formData.commission_rate)
                    const myRatio = formData.my_ratio || 50
                    const personal = calculatePersonalCommission(sales, myRatio)
                    const incentive = f(personal * formData.incentive_rate / 100)
                    const tax = f(incentive * 0.033)
                    const net = f(incentive - tax)

                    const roleText = formData.my_role === 'PM_SOLO' ? 'PM 단독' :
                                    formData.my_role === 'PM' ? `PM(${myRatio}%)` :
                                    `써처(${myRatio}%)`

                    return `실매출 ${sales.toLocaleString()}만 / 개인 매출액 ${personal.toLocaleString()}만 (${roleText}) / 인센티브 ${incentive.toLocaleString()}만 / 실수령 ${net.toLocaleString()}만원`
                  })()}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', gap: '8px' }}>
                <button
                  type="submit"
                  style={{ padding: '8px 28px', background: '#b8860b', color: '#1c1917', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {editingId ? '수정' : '등록'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    resetForm()
                  }}
                  style={{ padding: '8px 20px', background: '#e7e5e4', color: '#44403c', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 테이블 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#a8a29e' }}>로딩 중...</div>
        ) : settlements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px', color: '#a8a29e' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>💰</div>
            <div style={{ fontSize: '13px' }}>정산 내역이 없습니다. + 정산 추가를 눌러 등록하세요.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#f5f5f4', borderBottom: '2px solid #d6d3d1' }}>
                  {['No', '합격자', '입사일', '연봉(만)', '수수료율%', '실매출액(만)', '개인매출액(만)', '누적 개인매출', '요율', '인센티브(만)', '세금(3.3%)', '실수령(만)', '고객사', '포지션', '요율'].map(h => (
                    <th key={h} style={{ padding: '9px 10px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#1c1917', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let cumPersonal = 0
                  let conversionDone = false
                  const threshold = goalAmount + carryover
                  return settlements.map((s, idx) => {
                    const sales = calculateCommission(s.salary, s.commission_rate)
                    const myRatio = s.my_ratio || 50 // 내 비율
                    const personal = calculatePersonalCommission(sales, myRatio) // 개인 매출액 (실매출액 × my_ratio)

                    const alreadyConverted = threshold > 0 && cumPersonal >= threshold
                    const willConvert = threshold > 0 && !alreadyConverted && (cumPersonal + personal) >= threshold
                    const isConvRow = willConvert && !conversionDone
                    if (willConvert) conversionDone = true

                    // 요율 계산
                    const ir = threshold > 0 ? (alreadyConverted ? 100 : s.incentive_rate) : s.incentive_rate

                    // 인센티브 계산
                    let incentive, seventyPart, hundredPart, incentiveSeventyPart, incentiveHundredPart
                    if (willConvert) {
                      // 전환 시 분할 계산
                      seventyPart = f(threshold - cumPersonal) // 70% 구간
                      hundredPart = f(personal - seventyPart) // 100% 구간
                      incentiveSeventyPart = f(seventyPart * s.incentive_rate / 100) // 70%
                      incentiveHundredPart = f(hundredPart * 100 / 100) // 100%
                      incentive = f(incentiveSeventyPart + incentiveHundredPart)
                    } else {
                      incentive = f(personal * ir / 100)
                    }

                    cumPersonal += personal
                    const tax = f(incentive * 0.033)
                    const net = f(incentive - tax)

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #e7e5e4' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1c1917', fontSize: '11px' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px', minWidth: '90px' }}>
                          <button
                            onClick={() => startEdit(s)}
                            style={{ minWidth: '82px', padding: '4px 7px', border: '1px solid #d6d3d1', borderRadius: '5px', fontSize: '12px', background: '#f5f5f4', color: '#1c1917', cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {s.candidate_name}
                          </button>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: '#1c1917' }}>{formatDate(s.start_date)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#1c1917' }}>{s.salary.toLocaleString()}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1c1917' }}>{s.commission_rate}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#b8860b', fontWeight: 600 }}>{sales.toLocaleString()}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#3b82f6', fontWeight: 600 }}>
                          {willConvert ? (
                            <div style={{ lineHeight: 1.6 }}>
                              <div>
                                <span style={{ color: '#b8860b' }}>{seventyPart!.toLocaleString()}</span>
                                <span style={{ fontSize: '10px', color: '#78716c', marginLeft: '3px' }}>70%</span>
                              </div>
                              <div>
                                <span style={{ color: '#15803d' }}>{hundredPart!.toLocaleString()}</span>
                                <span style={{ fontSize: '10px', color: '#78716c', marginLeft: '3px' }}>100%</span>
                              </div>
                            </div>
                          ) : personal.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1c1917' }}>{cumPersonal.toLocaleString()}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '20px',
                            background: isConvRow ? '#dbeafe' : alreadyConverted ? '#dcfce7' : '#fef3c7',
                            color: isConvRow ? '#1e40af' : alreadyConverted ? '#15803d' : '#92400e',
                            border: `1px solid ${isConvRow ? '#93c5fd' : alreadyConverted ? '#86efac' : '#e8d0a0'}`
                          }}>
                            {isConvRow ? '70%→100%' : `${ir}%`}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>
                          {willConvert ? (
                            <div style={{ lineHeight: 1.6 }}>
                              <div style={{ fontSize: '11px' }}>
                                {incentiveSeventyPart!.toLocaleString()} + {incentiveHundredPart!.toLocaleString()}
                              </div>
                              <div style={{ fontWeight: 700 }}>{incentive.toLocaleString()}</div>
                            </div>
                          ) : incentive.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#1c1917' }}>{tax.toLocaleString()}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1c1917' }}>{net.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: '#1c1917' }}>{s.company || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: '#1c1917' }}>{s.position || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleDelete(s.id)}
                            style={{ padding: '3px 7px', background: 'none', border: '1px solid #d6d3d1', borderRadius: '5px', fontSize: '11px', color: '#dc2626', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

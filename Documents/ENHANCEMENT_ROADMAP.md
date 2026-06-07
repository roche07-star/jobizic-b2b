# Jobizic B2B Enhancement Roadmap

**일시**: 2026-06-08  
**참석자**: 디바 (Backend/총괄), 테스 (QA/검증)  
**목적**: 향후 개선 가능한 구현 사항 검토 및 우선순위 설정

---

## 📋 목차

1. [알림 시스템 확장](#1-알림-시스템-확장)
2. [분석 및 리포팅](#2-분석-및-리포팅)
3. [AI/자동화 고도화](#3-ai자동화-고도화)
4. [협업 기능 강화](#4-협업-기능-강화)
5. [성능 및 확장성](#5-성능-및-확장성)
6. [보안 강화](#6-보안-강화)
7. [UX/UI 개선](#7-uxui-개선)
8. [통합 및 연동](#8-통합-및-연동)
9. [우선순위 매트릭스](#9-우선순위-매트릭스)

---

## 1. 알림 시스템 확장

### 1.1 이메일 알림 (Priority: HIGH)

**현황**:
- ✅ 웹 알림 (DB 저장)
- ✅ 텔레그램 알림 (일부)
- ❌ 이메일 알림 없음

**개선안**:
```typescript
// 이메일 템플릿 시스템
interface EmailTemplate {
  type: 'jd_registered' | 'candidate_recommended' | 'stage_changed'
  to: string[]
  subject: string
  body: string  // HTML 템플릿
  attachments?: File[]
}

// 배치 발송 (1일 1회 요약)
interface DailyDigest {
  userId: string
  newJDs: number
  newCandidates: number
  stageChanges: PipelineStage[]
  pendingActions: Action[]
}
```

**구현 난이도**: ⭐⭐☆☆☆ (Medium)  
**비즈니스 가치**: ⭐⭐⭐⭐⭐ (Very High)  
**예상 공수**: 2주

**테스 의견**:
> "이메일은 필수입니다. 텔레그램 미연동 사용자가 많을 수 있고, 공식 커뮤니케이션은 이메일이 표준입니다."

---

### 1.2 슬랙 통합 (Priority: MEDIUM)

**개선안**:
- Slack Webhook으로 조직 채널에 알림
- `/jd`, `/pipeline` 슬랙 커맨드
- 인터랙티브 버튼 (단계 변경, 승인/거부)

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐☆☆ (Medium-High)  
**예상 공수**: 3주

---

### 1.3 알림 설정 관리 (Priority: HIGH)

**개선안**:
```typescript
interface NotificationPreference {
  userId: string
  email: {
    enabled: boolean
    digest: 'realtime' | 'daily' | 'weekly'
    events: {
      jd_registered: boolean
      candidate_recommended: boolean
      stage_changed: boolean
      assignment: boolean
    }
  }
  telegram: {
    enabled: boolean
    events: { ... }
  }
  web: {
    enabled: boolean
    events: { ... }
  }
}
```

**구현 난이도**: ⭐⭐☆☆☆ (Medium)  
**비즈니스 가치**: ⭐⭐⭐⭐☆ (High)  
**예상 공수**: 1주

---

## 2. 분석 및 리포팅

### 2.1 대시보드 (Priority: VERY HIGH)

**현황**:
- ❌ 대시보드 없음
- ❌ 통계 데이터 없음

**개선안**:

#### Owner/Admin 대시보드
```typescript
interface OwnerDashboard {
  overview: {
    activeJDs: number          // 진행 중인 JD
    totalCandidates: number    // 전체 후보자
    pipelineCount: number      // 진행 중인 프로세스
    avgMatchScore: number      // 평균 매칭 점수
  }
  
  charts: {
    // 주간 활동 트렌드
    weeklyActivity: {
      date: string
      newJDs: number
      newCandidates: number
      stageChanges: number
    }[]
    
    // 단계별 분포
    stageDistribution: {
      stage: string
      count: number
      percentage: number
    }[]
    
    // PM별 성과
    pmPerformance: {
      pmName: string
      jdCount: number
      candidateCount: number
      successRate: number  // 합격률
    }[]
    
    // 산업별 JD 분포
    industryBreakdown: {
      industry: string
      count: number
    }[]
  }
  
  insights: {
    // AI 인사이트
    topPerformingPM: string
    bottleneckStage: string      // 병목 단계
    avgTimePerStage: {            // 단계별 평균 소요 시간
      stage: string
      days: number
    }[]
  }
}
```

#### PM(Headhunter) 대시보드
```typescript
interface PMDashboard {
  myStats: {
    myJDs: number
    myCandidates: number
    successRate: number
    avgMatchScore: number
  }
  
  recentActivity: Activity[]
  
  pendingActions: {
    type: 'review' | 'interview' | 'decision'
    candidate: string
    jd: string
    daysWaiting: number
  }[]
}
```

**구현 난이도**: ⭐⭐⭐⭐☆ (High)  
**비즈니스 가치**: ⭐⭐⭐⭐⭐ (Very High)  
**예상 공수**: 4주

**테스 의견**:
> "대시보드는 최우선입니다. 현재 데이터를 보려면 여러 페이지를 돌아다녀야 합니다. 의사결정에 필수적입니다."

---

### 2.2 리포트 생성 (Priority: HIGH)

**개선안**:
```typescript
interface Report {
  type: 'weekly' | 'monthly' | 'custom'
  period: { from: Date; to: Date }
  
  // PDF/Excel 다운로드
  format: 'pdf' | 'excel' | 'csv'
  
  sections: {
    summary: boolean           // 요약
    jdList: boolean           // JD 목록
    candidateList: boolean    // 후보자 목록
    pipelineAnalysis: boolean // 파이프라인 분석
    pmPerformance: boolean    // PM 성과
  }
  
  // 자동 이메일 발송
  schedule?: {
    frequency: 'weekly' | 'monthly'
    recipients: string[]
    dayOfWeek?: number  // 0-6 (Monday-Sunday)
    dayOfMonth?: number // 1-31
  }
}
```

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐⭐☆ (High)  
**예상 공수**: 3주

---

### 2.3 실시간 분석 (Priority: MEDIUM)

**개선안**:
- Google Analytics 통합
- 사용자 행동 트래킹
- Conversion Funnel 분석
- A/B 테스트 인프라

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐☆☆ (Medium-High)  
**예상 공수**: 2주

---

## 3. AI/자동화 고도화

### 3.1 AI 매칭 점수 개선 (Priority: HIGH)

**현황**:
- ✅ Anthropic Claude로 매칭 점수 계산
- ✅ Prompt Caching으로 비용 90% 절감
- ⚠️ 매칭 기준이 일반적 (커스터마이징 부족)

**개선안**:

#### 학습 기반 매칭
```typescript
interface MatchingModel {
  // 조직별 커스텀 가중치
  organizationWeights: {
    organizationId: string
    weights: {
      skillMatch: number        // 0-1
      experienceMatch: number
      educationMatch: number
      locationMatch: number
      salaryMatch: number
      cultureMatch: number      // 새로 추가
    }
  }
  
  // 과거 데이터 학습
  historicalData: {
    jdId: string
    candidateId: string
    matchScore: number
    actualResult: 'hired' | 'rejected' | 'withdrawn'
    feedback?: string
  }[]
  
  // 개선된 매칭 점수
  improvedScore: number  // 과거 데이터 기반 조정
}
```

#### Fine-tuning with Anthropic
```typescript
// 조직별 성공 사례 학습
interface FineTuningData {
  organizationId: string
  successfulMatches: {
    jd: string
    resume: string
    outcome: 'hired'
    timeToHire: number
  }[]
  
  // Claude에 피드백
  modelFeedback: string
}
```

**구현 난이도**: ⭐⭐⭐⭐☆ (High)  
**비즈니스 가치**: ⭐⭐⭐⭐⭐ (Very High)  
**예상 공수**: 6주

---

### 3.2 자동 후보자 추천 (Priority: MEDIUM)

**개선안**:
```typescript
interface AutoRecommendation {
  // 새 JD 등록 시 자동으로 매칭
  enabled: boolean
  
  // 최소 매칭 점수 (이상만 자동 추천)
  minScore: number  // 기본 80점
  
  // 최대 추천 수
  maxCandidates: number  // 기본 10명
  
  // 알림
  notifyOwner: boolean
  notifyRecommender: boolean
  
  // 배치 실행 (매일 자정)
  schedule: 'realtime' | 'daily' | 'weekly'
}

// Cron Job
async function runAutoRecommendation() {
  const newJDs = await getJDsWithoutCandidates()
  const allCandidates = await getAllActiveCandidates()
  
  for (const jd of newJDs) {
    const matches = await analyzeMatches(jd, allCandidates)
    const topMatches = matches
      .filter(m => m.score >= 80)
      .slice(0, 10)
    
    for (const match of topMatches) {
      await createPipeline({
        jdId: jd.id,
        candidateId: match.candidateId,
        matchScore: match.score,
        created_by: 'system@auto',  // 자동 추천 표시
        stage: '신규'
      })
      
      await notifyJDOwner(jd, match)
    }
  }
}
```

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐⭐☆ (High)  
**예상 공수**: 3주

**테스 의견**:
> "자동 추천은 PM 업무를 크게 줄여줄 수 있습니다. 단, 오추천 방지를 위해 최소 점수 설정이 중요합니다."

---

### 3.3 스마트 단계 자동 이동 (Priority: LOW)

**개선안**:
```typescript
interface AutoStageTransition {
  // 조건 기반 자동 단계 이동
  rules: {
    from: string
    to: string
    conditions: {
      daysInStage: number       // N일 경과 시
      noActivity: boolean       // 활동 없음
      candidateAction?: string  // 후보자 액션 (예: 서류 제출)
    }
    autoMove: boolean
    notifyOwner: boolean
  }[]
}

// 예시
const rules = [
  {
    from: '신규',
    to: '서류검토',
    conditions: { daysInStage: 3, noActivity: true },
    autoMove: true  // 3일 지나면 자동으로 서류검토로 이동
  },
  {
    from: '1차면접',
    to: '불합격',
    conditions: { daysInStage: 14, noActivity: true },
    autoMove: false,  // 알림만
    notifyOwner: true
  }
]
```

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐☆☆☆ (Medium)  
**예상 공수**: 2주

---

## 4. 협업 기능 강화

### 4.1 댓글 및 피드백 시스템 (Priority: HIGH)

**현황**:
- ❌ 댓글 기능 없음
- ❌ 피드백 시스템 없음

**개선안**:
```typescript
interface Comment {
  id: string
  relatedType: 'jd' | 'candidate' | 'pipeline'
  relatedId: string
  
  userId: string
  userName: string
  userRole: string
  
  content: string
  createdAt: Date
  updatedAt?: Date
  
  // 멘션
  mentions: string[]  // [@user@email.com]
  
  // 첨부파일
  attachments?: {
    name: string
    url: string
    type: string
  }[]
  
  // 스레드
  parentId?: string
  replies?: Comment[]
}

// API
POST /api/comments
GET /api/comments?type=pipeline&id=123
PATCH /api/comments/:id
DELETE /api/comments/:id
```

**UI 예시**:
```
📝 댓글 (3)

홍길동 (PM) · 2시간 전
@이영희 이 후보자 1차 면접 일정 잡아주세요.
첨부: interview_schedule.pdf

  └─ 이영희 (Admin) · 1시간 전
     네, 내일 오후 2시로 확정했습니다.

김철수 (Searcher) · 30분 전
급여 협상 여지 있을까요?
```

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐⭐⭐ (Very High)  
**예상 공수**: 3주

**테스 의견**:
> "댓글 시스템은 필수입니다. 현재는 Slack이나 이메일로 따로 소통하는데, 맥락이 분산됩니다. 플랫폼 내에서 모든 대화가 이뤄져야 합니다."

---

### 4.2 태스크 관리 (Priority: MEDIUM)

**개선안**:
```typescript
interface Task {
  id: string
  title: string
  description: string
  
  relatedType: 'jd' | 'candidate' | 'pipeline'
  relatedId: string
  
  assignedTo: string
  assignedBy: string
  
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  
  dueDate?: Date
  completedAt?: Date
  
  checklist?: {
    item: string
    done: boolean
  }[]
}

// 예시
const task = {
  title: "1차 면접 일정 조율",
  description: "김철수 후보자 1차 면접 일정을 이번 주 내로 잡아주세요.",
  relatedType: 'pipeline',
  relatedId: 'pipeline-123',
  assignedTo: 'admin@example.com',
  status: 'todo',
  priority: 'high',
  dueDate: '2026-06-12',
  checklist: [
    { item: '후보자 가능 시간 확인', done: true },
    { item: '면접관 스케줄 확인', done: false },
    { item: '면접실 예약', done: false }
  ]
}
```

**구현 난이도**: ⭐⭐⭐⭐☆ (High)  
**비즈니스 가치**: ⭐⭐⭐⭐☆ (High)  
**예상 공수**: 4주

---

### 4.3 활동 타임라인 (Priority: LOW)

**개선안**:
```typescript
interface ActivityTimeline {
  pipelineId: string
  
  events: {
    timestamp: Date
    type: 'created' | 'stage_changed' | 'comment_added' | 
          'task_assigned' | 'document_uploaded' | 'interview_scheduled'
    actor: string
    actorName: string
    description: string
    metadata?: any
  }[]
}
```

**UI 예시**:
```
📅 활동 타임라인

2026-06-08 14:30 · 홍길동 (PM)
└─ 📝 댓글 추가: "1차 면접 일정 조율 부탁드립니다."

2026-06-08 10:15 · 이영희 (Admin)
└─ 🔄 단계 변경: 신규 → 서류검토

2026-06-07 16:20 · 김철수 (Searcher)
└─ ✨ 후보자 추천 (매칭 점수: 85점)
```

**구현 난이도**: ⭐⭐☆☆☆ (Medium)  
**비즈니스 가치**: ⭐⭐⭐☆☆ (Medium-High)  
**예상 공수**: 2주

---

## 5. 성능 및 확장성

### 5.1 페이지네이션 및 무한 스크롤 (Priority: HIGH)

**현황**:
- ⚠️ 모든 데이터를 한 번에 로드
- ⚠️ 데이터 많아지면 성능 저하 가능

**개선안**:
```typescript
// API 페이지네이션
GET /api/pipeline?page=1&limit=20&sortBy=created_at&order=desc

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Frontend 무한 스크롤
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['pipeline'],
  queryFn: ({ pageParam = 1 }) => fetchPipeline(pageParam),
  getNextPageParam: (lastPage) => 
    lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined
})
```

**구현 난이도**: ⭐⭐☆☆☆ (Medium)  
**비즈니스 가치**: ⭐⭐⭐⭐☆ (High)  
**예상 공수**: 1주

---

### 5.2 검색 및 필터링 고도화 (Priority: HIGH)

**현황**:
- ⚠️ 기본적인 필터만 존재
- ❌ 전체 텍스트 검색 없음

**개선안**:
```typescript
interface AdvancedSearch {
  // 전체 텍스트 검색 (PostgreSQL Full-Text Search)
  query?: string
  
  // 다중 필터
  filters: {
    stage?: string[]          // ['1차면접', '2차면접']
    matchScore?: { min: number; max: number }
    dateRange?: { from: Date; to: Date }
    companies?: string[]
    positions?: string[]
    industries?: string[]
    locations?: string[]
    salaryRange?: { min: number; max: number }
  }
  
  // 정렬
  sortBy: 'created_at' | 'match_score' | 'company' | 'stage'
  order: 'asc' | 'desc'
  
  // 저장된 필터 (즐겨찾기)
  savedFilters?: {
    name: string
    filters: object
  }[]
}

// PostgreSQL Full-Text Search
CREATE INDEX pipeline_search_idx ON pipeline 
USING GIN (to_tsvector('korean', 
  coalesce(company, '') || ' ' || 
  coalesce(position, '') || ' ' ||
  coalesce(candidate_name, '')
));

// Supabase 쿼리
const { data } = await supabaseAdmin
  .from('pipeline')
  .select('*')
  .textSearch('fts', 'samsung engineer', { config: 'korean' })
  .gte('match_score', 80)
  .in('stage', ['1차면접', '2차면접'])
  .order('match_score', { ascending: false })
```

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐⭐⭐ (Very High)  
**예상 공수**: 2주

---

### 5.3 캐싱 전략 (Priority: MEDIUM)

**개선안**:
```typescript
// Redis 캐싱
interface CacheStrategy {
  // 자주 조회되는 데이터 캐싱
  candidates: {
    ttl: 300  // 5분
    key: 'candidates:org:{orgId}'
  }
  
  jds: {
    ttl: 300
    key: 'jds:org:{orgId}'
  }
  
  pipeline: {
    ttl: 60   // 1분 (실시간성 중요)
    key: 'pipeline:org:{orgId}:user:{userId}'
  }
  
  // 분석 데이터 (무거운 쿼리)
  dashboard: {
    ttl: 3600  // 1시간
    key: 'dashboard:org:{orgId}'
  }
}

// SWR (Stale-While-Revalidate) - Frontend
import useSWR from 'swr'

const { data, error, mutate } = useSWR(
  `/api/pipeline?org=${orgId}`,
  fetcher,
  {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 30000  // 30초마다 자동 갱신
  }
)
```

**구현 난이도**: ⭐⭐⭐⭐☆ (High)  
**비즈니스 가치**: ⭐⭐⭐☆☆ (Medium-High)  
**예상 공수**: 3주

---

## 6. 보안 강화

### 6.1 감사 로그 (Audit Log) (Priority: HIGH)

**현황**:
- ❌ 감사 로그 없음
- ⚠️ 누가 언제 무엇을 변경했는지 추적 불가

**개선안**:
```typescript
interface AuditLog {
  id: string
  timestamp: Date
  
  // 주체
  userId: string
  userName: string
  userRole: string
  ipAddress: string
  userAgent: string
  
  // 행위
  action: 'create' | 'read' | 'update' | 'delete'
  resource: 'jd' | 'candidate' | 'pipeline' | 'user' | 'organization'
  resourceId: string
  
  // 변경 내용
  changes?: {
    field: string
    oldValue: any
    newValue: any
  }[]
  
  // 결과
  success: boolean
  errorMessage?: string
}

// 예시
const auditLog = {
  timestamp: '2026-06-08T14:30:00Z',
  userId: 'user-123',
  userName: '홍길동',
  userRole: 'headhunter',
  ipAddress: '192.168.1.100',
  action: 'update',
  resource: 'pipeline',
  resourceId: 'pipeline-456',
  changes: [
    { field: 'stage', oldValue: '신규', newValue: '1차면접' }
  ],
  success: true
}

// 조회 API
GET /api/audit-logs?resource=pipeline&resourceId=456
GET /api/audit-logs?userId=user-123&from=2026-06-01&to=2026-06-08
```

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐⭐⭐ (Very High)  
**예상 공수**: 2주

**테스 의견**:
> "감사 로그는 필수입니다. 특히 B2B는 컴플라이언스, 보안 감사, 문제 추적에 중요합니다. GDPR, ISO 27001 대응에도 필요합니다."

---

### 6.2 API Rate Limiting (Priority: MEDIUM)

**개선안**:
```typescript
// Vercel Edge Config + Upstash Redis
interface RateLimitConfig {
  // 사용자별
  perUser: {
    requests: 100
    window: '1m'  // 1분
  }
  
  // IP별
  perIP: {
    requests: 1000
    window: '1h'
  }
  
  // 엔드포인트별
  endpoints: {
    '/api/analyze': {
      requests: 10
      window: '1m'  // AI 호출은 제한적
    }
    '/api/pipeline': {
      requests: 100
      window: '1m'
    }
  }
}

// Middleware
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m')
})

export async function middleware(req: NextRequest) {
  const ip = req.ip ?? '127.0.0.1'
  const { success, limit, reset, remaining } = await ratelimit.limit(ip)
  
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString()
        }
      }
    )
  }
  
  return NextResponse.next()
}
```

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐☆☆ (Medium-High)  
**예상 공수**: 1주

---

### 6.3 데이터 암호화 (Priority: HIGH)

**개선안**:
```typescript
// 민감 정보 암호화
interface EncryptedData {
  // 후보자 개인정보
  candidate: {
    name: string          // 평문
    email: string         // 평문
    phone: string         // ✅ 암호화
    address: string       // ✅ 암호화
    ssn?: string          // ✅ 암호화 (주민등록번호)
    bankAccount?: string  // ✅ 암호화
  }
  
  // JD 급여 정보
  jd: {
    salaryMin: number     // ✅ 암호화
    salaryMax: number     // ✅ 암호화
  }
}

// AES-256 암호화
import crypto from 'crypto'

const algorithm = 'aes-256-gcm'
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':')
  
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
```

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐⭐⭐ (Very High)  
**예상 공수**: 2주

---

## 7. UX/UI 개선

### 7.1 드래그 앤 드롭 파이프라인 (Priority: HIGH)

**현황**:
- ⚠️ 드롭다운으로 단계 변경
- ⚠️ 직관성 부족

**개선안**:
```typescript
// React DnD 또는 dnd-kit
import { DndContext, DragEndEvent } from '@dnd-kit/core'

function PipelineBoard() {
  const stages = ['신규', '서류검토', '1차면접', '2차면접', '최종면접', '처우협의', '합격']
  
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      const pipelineId = active.id
      const newStage = over.id as string
      
      await updateStage(pipelineId, newStage)
    }
  }
  
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="pipeline-board">
        {stages.map(stage => (
          <StageColumn key={stage} stage={stage}>
            {pipelines
              .filter(p => p.stage === stage)
              .map(pipeline => (
                <DraggableCard key={pipeline.id} pipeline={pipeline} />
              ))}
          </StageColumn>
        ))}
      </div>
    </DndContext>
  )
}
```

**UI 예시**:
```
┌─────────┬─────────┬─────────┬─────────┐
│  신규   │ 서류검토 │ 1차면접  │ 2차면접  │
├─────────┼─────────┼─────────┼─────────┤
│ 김철수  │ 이영희  │ 박민수  │ 정수진  │
│ [85점]  │ [92점]  │ [78점]  │ [88점]  │
│         │         │         │         │
│ 홍길동  │         │ 최지우  │         │
│ [73점]  │         │ [81점]  │         │
└─────────┴─────────┴─────────┴─────────┘

← 드래그 앤 드롭으로 단계 이동 →
```

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐⭐⭐ (Very High)  
**예상 공수**: 2주

**테스 의견**:
> "칸반 보드 형태의 드래그 앤 드롭은 UX를 획기적으로 개선합니다. Jira, Trello처럼 직관적이고 빠릅니다."

---

### 7.2 모바일 반응형 개선 (Priority: MEDIUM)

**현황**:
- ⚠️ 모바일 최적화 부족

**개선안**:
- Tailwind CSS Responsive Design
- 모바일 전용 네비게이션 (햄버거 메뉴)
- 터치 제스처 지원
- PWA (Progressive Web App) 지원

**구현 난이도**: ⭐⭐⭐☆☆ (Medium-High)  
**비즈니스 가치**: ⭐⭐⭐⭐☆ (High)  
**예상 공수**: 3주

---

### 7.3 다크 모드 (Priority: LOW)

**개선안**:
```typescript
// next-themes
import { ThemeProvider } from 'next-themes'

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system">
      {children}
    </ThemeProvider>
  )
}

// Tailwind config
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      }
    }
  }
}
```

**구현 난이도**: ⭐⭐☆☆☆ (Medium)  
**비즈니스 가치**: ⭐⭐☆☆☆ (Medium)  
**예상 공수**: 1주

---

## 8. 통합 및 연동

### 8.1 캘린더 통합 (Priority: HIGH)

**개선안**:
```typescript
// Google Calendar, Outlook 통합
interface CalendarIntegration {
  // 면접 일정 자동 등록
  createInterview: {
    pipelineId: string
    type: '1차면접' | '2차면접' | '최종면접'
    date: Date
    duration: number  // minutes
    attendees: string[]
    location?: string
    meetingLink?: string  // Zoom, Google Meet
  }
  
  // 캘린더 동기화
  sync: {
    provider: 'google' | 'outlook'
    accessToken: string
    refreshToken: string
  }
}

// 면접 일정 생성 시 자동으로 캘린더 이벤트 생성
async function scheduleInterview(data: InterviewSchedule) {
  // 1. DB에 저장
  const interview = await createInterview(data)
  
  // 2. Google Calendar 이벤트 생성
  const event = await googleCalendar.events.insert({
    calendarId: 'primary',
    resource: {
      summary: `면접: ${data.candidateName} - ${data.position}`,
      description: `후보자: ${data.candidateName}\n포지션: ${data.position}\n매칭 점수: ${data.matchScore}`,
      start: { dateTime: data.startTime },
      end: { dateTime: data.endTime },
      attendees: data.attendees.map(email => ({ email })),
      conferenceData: {
        createRequest: { requestId: crypto.randomUUID() }
      }
    },
    conferenceDataVersion: 1
  })
  
  // 3. Meet 링크를 DB에 저장
  await updateInterview(interview.id, {
    meetingLink: event.data.hangoutLink
  })
  
  return interview
}
```

**구현 난이도**: ⭐⭐⭐⭐☆ (High)  
**비즈니스 가치**: ⭐⭐⭐⭐⭐ (Very High)  
**예상 공수**: 3주

---

### 8.2 링크드인 통합 (Priority: MEDIUM)

**개선안**:
```typescript
// LinkedIn API 통합
interface LinkedInIntegration {
  // 프로필 가져오기
  importProfile: {
    linkedInUrl: string
    // 자동으로 이력서 파싱
    profile: {
      name: string
      headline: string
      experience: Experience[]
      education: Education[]
      skills: string[]
    }
  }
  
  // InMail 발송
  sendInMail: {
    recipientUrn: string
    subject: string
    body: string
  }
}
```

**구현 난이도**: ⭐⭐⭐⭐☆ (High)  
**비즈니스 가치**: ⭐⭐⭐⭐☆ (High)  
**예상 공수**: 4주

---

### 8.3 ATS 통합 (Priority: LOW)

**개선안**:
- Greenhouse, Lever, Workday 등 주요 ATS와 연동
- 양방향 동기화
- Webhook 기반 실시간 업데이트

**구현 난이도**: ⭐⭐⭐⭐⭐ (Very High)  
**비즈니스 가치**: ⭐⭐⭐☆☆ (Medium-High)  
**예상 공수**: 8주

---

## 9. 우선순위 매트릭스

### 9.1 Impact vs Effort

```
High Impact, Low Effort (Quick Wins) 🎯
- 이메일 알림
- 알림 설정 관리
- 페이지네이션
- 검색/필터링 고도화
- 감사 로그
- 댓글 시스템

High Impact, High Effort (Major Projects) 🚀
- 대시보드
- AI 매칭 개선
- 캘린더 통합
- 드래그 앤 드롭 파이프라인
- 데이터 암호화

Low Impact, Low Effort (Fill-ins) 💡
- 다크 모드
- 활동 타임라인

Low Impact, High Effort (Avoid) ⚠️
- ATS 통합 (현재 시점에서)
```

---

### 9.2 Phase별 로드맵

#### Phase 1: Foundation (1-2개월)
**목표**: 안정성 및 기본 기능 강화

1. ✅ 이메일 알림 (2주)
2. ✅ 알림 설정 관리 (1주)
3. ✅ 페이지네이션 (1주)
4. ✅ 검색/필터링 고도화 (2주)
5. ✅ 감사 로그 (2주)
6. ✅ 데이터 암호화 (2주)

**총 공수**: 10주 (2.5개월)

---

#### Phase 2: Productivity (2-3개월)
**목표**: 생산성 및 협업 강화

1. ✅ 댓글 시스템 (3주)
2. ✅ 대시보드 (4주)
3. ✅ 드래그 앤 드롭 파이프라인 (2주)
4. ✅ 리포트 생성 (3주)
5. ✅ 태스크 관리 (4주)

**총 공수**: 16주 (4개월)

---

#### Phase 3: Intelligence (3-4개월)
**목표**: AI 및 자동화 고도화

1. ✅ AI 매칭 개선 (6주)
2. ✅ 자동 후보자 추천 (3주)
3. ✅ 슬랙 통합 (3주)
4. ✅ 캘린더 통합 (3주)

**총 공수**: 15주 (3.75개월)

---

#### Phase 4: Scale (4개월+)
**목표**: 확장성 및 엔터프라이즈 기능

1. ✅ 캐싱 전략 (3주)
2. ✅ API Rate Limiting (1주)
3. ✅ 모바일 반응형 개선 (3주)
4. ✅ 링크드인 통합 (4주)
5. ✅ 실시간 분석 (2주)

**총 공수**: 13주 (3.25개월)

---

## 10. 결론 및 제안

### 10.1 디바의 추천 (Top 5)

1. **이메일 알림** (Phase 1)
   - 가장 기본적이면서 필수적인 기능
   - 텔레그램 미사용자 커버
   - 공식 커뮤니케이션 채널

2. **대시보드** (Phase 2)
   - 의사결정에 필수
   - 현재 상태 한눈에 파악
   - Owner/PM 모두에게 가치

3. **댓글 시스템** (Phase 2)
   - 협업 효율성 대폭 향상
   - 맥락 유지
   - 커뮤니케이션 중앙화

4. **검색/필터링 고도화** (Phase 1)
   - 데이터 많아질수록 필수
   - 생산성 직결
   - 빠른 구현 가능

5. **감사 로그** (Phase 1)
   - 보안 및 컴플라이언스
   - 문제 추적
   - 신뢰성 향상

---

### 10.2 테스의 검증 의견

**필수 (Must-have)**:
- ✅ 이메일 알림
- ✅ 대시보드
- ✅ 감사 로그
- ✅ 검색/필터링
- ✅ 데이터 암호화

**권장 (Should-have)**:
- ✅ 댓글 시스템
- ✅ 드래그 앤 드롭
- ✅ AI 매칭 개선
- ✅ 캘린더 통합
- ✅ 페이지네이션

**옵션 (Nice-to-have)**:
- 슬랙 통합
- 태스크 관리
- 자동 추천
- 모바일 개선
- 다크 모드

---

### 10.3 비용 및 리소스 예상

#### Phase 1 (Foundation)
- **개발 공수**: 10주
- **개발자**: 디바(Backend) + 디아(Frontend)
- **QA**: 테스 (각 기능당 3-5일)
- **예상 비용**: 
  - 인건비: 2명 × 2.5개월 × $8,000 = $40,000
  - 인프라: Redis, Email Service = $200/월

#### Phase 2 (Productivity)
- **개발 공수**: 16주
- **개발자**: 디바 + 디아 + (UI Designer 1명 추가)
- **QA**: 테스
- **예상 비용**: 
  - 인건비: 3명 × 4개월 × $8,000 = $96,000

#### Phase 3 (Intelligence)
- **개발 공수**: 15주
- **개발자**: 디바 + 디아 + (AI Engineer 1명 추가)
- **예상 비용**: 
  - 인건비: 3명 × 3.75개월 × $8,000 = $90,000
  - AI API: Claude API 비용 증가 = $500/월

#### 총 예상 비용 (1년)
- **개발 인건비**: ~$226,000
- **인프라**: ~$8,400/년
- **총합**: ~$235,000

---

### 10.4 즉시 시작 가능한 Quick Wins

**이번 주 착수 가능**:
1. 이메일 알림 기본 구조 (3일)
2. 페이지네이션 (2일)
3. 알림 설정 UI (2일)

**다음 주 착수**:
1. 감사 로그 스키마 설계 (2일)
2. 검색 인덱스 구축 (3일)
3. 대시보드 와이어프레임 (3일)

---

## 📊 최종 요약

### 우선순위 Top 10

| 순위 | 기능 | Phase | 공수 | Impact | Effort |
|-----|------|-------|------|--------|--------|
| 1 | 이메일 알림 | 1 | 2주 | ⭐⭐⭐⭐⭐ | ⭐⭐☆☆☆ |
| 2 | 대시보드 | 2 | 4주 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆ |
| 3 | 댓글 시스템 | 2 | 3주 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ |
| 4 | 검색/필터링 | 1 | 2주 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ |
| 5 | 감사 로그 | 1 | 2주 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ |
| 6 | 드래그앤드롭 | 2 | 2주 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ |
| 7 | AI 매칭 개선 | 3 | 6주 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆ |
| 8 | 페이지네이션 | 1 | 1주 | ⭐⭐⭐⭐☆ | ⭐⭐☆☆☆ |
| 9 | 데이터 암호화 | 1 | 2주 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ |
| 10 | 캘린더 통합 | 3 | 3주 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆ |

---

**작성**: 2026-06-08  
**보고**: 디바 (Backend 총괄), 테스 (QA 전문가)  
**검토**: 대기 중  
**다음 단계**: 우선순위 승인 후 Phase 1 착수

---

**디바의 코멘트**:
> "현재 시스템은 MVP로서 잘 작동하고 있습니다. 하지만 스케일업을 위해서는 Phase 1과 Phase 2가 필수입니다. 특히 이메일 알림, 대시보드, 감사 로그는 엔터프라이즈 고객 확보에 결정적입니다."

**테스의 코멘트**:
> "기능 추가보다 안정성과 보안이 우선입니다. Phase 1을 먼저 완료하고, 철저한 테스트 후 Phase 2로 진행해야 합니다. 특히 데이터 암호화와 감사 로그는 B2B 서비스에서 타협 불가능한 요소입니다."

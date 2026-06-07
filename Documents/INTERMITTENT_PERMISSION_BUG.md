# 간헐적 권한 버그 긴급 보고

**일시**: 2026-06-07  
**참석자**: 디바 (Backend), 디아 (Frontend), 테스 (QA)  
**이슈**: PM 사용자가 가끔 모든 후보자를 보는 간헐적 버그

---

## 🔴 문제 상황 (업데이트)

**초기 보고**: 홍길동(PM)이 모든 7건을 볼 수 있음  
**현재 상태**: 지금은 정상 작동 (본인 것만 보임)  
**핵심 문제**: **간헐적으로 전체가 보였다가 정상으로 돌아옴**

이는 코드 로직 문제가 아닌 **타이밍, 캐싱, 또는 세션 문제**일 가능성이 높습니다.

---

## 🔍 간헐적 버그 가능한 원인

### 원인 A: 브라우저 캐싱 (40% 확률)

**증상**: 
- API 응답이 브라우저에 캐시됨
- 이전 사용자(Admin/Owner)의 결과가 캐시되어 표시됨

**재현 조건**:
1. Admin/Owner 계정으로 파이프라인 페이지 접속
2. 로그아웃
3. PM 계정으로 로그인
4. **캐시된 데이터**가 표시됨

**검증 방법**:
```
F12 → Network 탭 → Disable cache 체크
또는
Ctrl+Shift+R (강제 새로고침)
```

**해결책**:
```typescript
// Frontend: API 호출 시 cache 방지
fetch('/api/pipeline?...', {
  cache: 'no-store',
  headers: {
    'Cache-Control': 'no-cache'
  }
})
```

---

### 원인 B: 세션/Profile 로딩 타이밍 이슈 (30% 확률)

**증상**:
- `getProfile()` 호출이 완료되기 전에 API 호출
- role이 undefined로 전달됨
- Backend에서 role 필터 적용 안 됨

**재현 조건**:
1. 페이지 새로고침
2. Profile 로딩 느린 경우
3. API가 role 없이 호출됨

**검증 방법**:
```javascript
// Frontend Console에서 확인
console.log('Profile loaded:', profile)
console.log('API params:', params)
```

**해결책**:
```typescript
// Pipeline 페이지에서 profile이 완전히 로드될 때까지 대기
useEffect(() => {
  async function loadData() {
    const profile = await getProfile()
    if (!profile) return // 프로필 없으면 중단
    
    // profile이 확실히 로드된 후에만 API 호출
    const params = new URLSearchParams({
      role: profile.role, // 이제 확실히 값이 있음
      user_email: profile.email,
      ...
    })
  }
})
```

---

### 원인 C: Next.js Server/Client 상태 불일치 (20% 확률)

**증상**:
- Server-side와 Client-side 렌더링 불일치
- 초기 렌더링에서 잘못된 데이터 표시

**재현 조건**:
1. 페이지 직접 접근 (URL 입력)
2. 뒤로가기 후 앞으로가기
3. 새 탭에서 열기

**해결책**:
```typescript
// 'use client' 컴포넌트에서만 API 호출
// useEffect 내부에서만 데이터 로드
```

---

### 원인 D: Supabase OR 쿼리 타이밍 (5% 확률)

**증상**:
- `.or()` 쿼리가 가끔 무시됨
- Supabase 서버 부하 시 발생

**재현 조건**:
- 랜덤 (예측 불가)

**해결책**:
```typescript
// OR 쿼리 대신 두 번 쿼리 후 병합
const myJDPipelines = await supabaseAdmin
  .from('pipeline')
  .select('*')
  .in('jd_id', myJdIds)

const myRecommendations = await supabaseAdmin
  .from('pipeline')
  .select('*')
  .eq('created_by', userEmail)

const combined = [...myJDPipelines, ...myRecommendations]
// 중복 제거
const unique = Array.from(new Set(combined.map(p => p.id)))
  .map(id => combined.find(p => p.id === id))
```

---

### 원인 E: React State 업데이트 타이밍 (5% 확률)

**증상**:
- `profile` state가 업데이트되기 전에 API 호출
- 이전 state 값 사용

**재현 조건**:
1. 계정 전환
2. 빠른 페이지 이동

**해결책**:
```typescript
// profile이 변경될 때만 API 재호출
useEffect(() => {
  if (!profile) return
  loadData()
}, [profile]) // profile 의존성 추가
```

---

## 🧪 테스의 재현 시나리오

### 시나리오 1: 계정 전환
1. Admin 계정 로그인 → 파이프라인 페이지 접속
2. 로그아웃
3. PM(홍길동) 계정 로그인
4. **캐시 없이** 파이프라인 페이지 접속 (Ctrl+Shift+R)
5. 전체가 보이는지 확인

### 시나리오 2: 빠른 새로고침
1. PM 계정으로 파이프라인 페이지 접속
2. **F5 연타** (5-10회)
3. 중간에 전체가 보이는 순간이 있는지 확인

### 시나리오 3: 네트워크 느린 환경
1. F12 → Network 탭 → Throttling: Slow 3G
2. 파이프라인 페이지 새로고침
3. 로딩 중 데이터 확인

### 시나리오 4: 여러 탭
1. 탭 A: Admin 계정으로 파이프라인 페이지
2. 탭 B: PM 계정으로 로그인
3. 탭 B에서 파이프라인 페이지 열기
4. 전체가 보이는지 확인

---

## 💡 디바의 즉시 적용 수정

### 수정 1: Frontend - Cache 방지

```typescript
// app/pipeline/page.tsx
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

    // ✅ Cache 방지 추가
    const fetchOptions = {
      cache: 'no-store' as RequestCache,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    }

    Promise.all([
      fetch(`/api/pipeline?${params}`, fetchOptions).then(r => r.json()),
      fetch(`/api/jd?${params}`, fetchOptions).then(r => r.json()),
      fetch(`/api/candidates?${params}`, fetchOptions).then(r => r.json())
    ]).then(([pData, jData, cData]) => {
      setPipeline(pData.pipeline ?? [])
      setJds(jData.jds ?? [])
      setCandidates(cData.candidates ?? [])
    }).finally(() => setLoading(false))
  }
  loadData()
}, [selectedOrgId])
```

### 수정 2: Backend - 방어적 체크

```typescript
// app/api/pipeline/route.ts
export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get('role')
  const userEmail = req.nextUrl.searchParams.get('user_email')
  const organizationId = req.nextUrl.searchParams.get('organization_id')

  // ✅ 필수 파라미터 검증
  if (!role || !userEmail) {
    console.error('[pipeline] Missing required params:', { role, userEmail })
    return NextResponse.json({ 
      error: '필수 파라미터가 누락되었습니다.',
      pipeline: [] 
    }, { status: 400 })
  }

  // ... 기존 로직
}
```

### 수정 3: Backend - Cache Control 헤더

```typescript
// app/api/pipeline/route.ts
return NextResponse.json(
  { pipeline: enrichedData },
  {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store'
    }
  }
)
```

---

## 📊 디버그 로깅 유지

이미 추가한 디버그 로깅을 **당분간 유지**합니다:

```
[pipeline DEBUG] User: ... Role: ... OrgId: ...
[pipeline DEBUG] My JDs: [...]
[pipeline DEBUG] OR filter: ...
[pipeline DEBUG] Query returned N results
```

재현 시 Vercel 로그에서 정확한 원인 파악 가능.

---

## ✅ 테스트 체크리스트

### 재현 테스트 (간헐적 버그 찾기)
- [ ] 시나리오 1: 계정 전환
- [ ] 시나리오 2: 빠른 새로고침
- [ ] 시나리오 3: 네트워크 느린 환경
- [ ] 시나리오 4: 여러 탭

### 수정 후 검증
- [ ] Cache 방지 헤더 적용됨 (Network 탭 확인)
- [ ] 필수 파라미터 검증 작동
- [ ] 10회 이상 새로고침 후에도 정상
- [ ] 계정 전환 후에도 정상

---

## 🚨 긴급 조치 (우선순위)

1. **즉시**: Cache 방지 헤더 추가 (Frontend + Backend)
2. **즉시**: 필수 파라미터 검증 추가 (Backend)
3. **모니터링**: 디버그 로깅으로 재현 시 로그 수집
4. **테스트**: 4가지 재현 시나리오 반복 테스트

---

**작성**: 2026-06-07  
**보고**: 디바, 디아, 테스  
**상태**: 🟡 간헐적 버그 - 즉시 수정 적용 중  
**우선순위**: 🔴 HIGH - 권한 버그는 보안 이슈

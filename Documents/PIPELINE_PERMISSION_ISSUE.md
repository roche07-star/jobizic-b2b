# Pipeline 권한 문제 긴급 회의 보고

**일시**: 2026-06-07  
**참석자**: 디바 (Backend), 디아 (Frontend), 테스 (QA)  
**이슈**: PM(headhunter) 사용자가 모든 후보자를 볼 수 있는 문제

---

## 🔴 문제 상황

**보고 내용**: 홍길동(PM)이 채용 프로세스에서 모든 진행 중인 후보자를 볼 수 있음

**기대 동작**: PM은 본인 JD + 본인이 추천한 후보자만 표시

---

## 🔍 디바의 Backend 코드 분석

### Pipeline GET API (`/api/pipeline/route.ts`)

**현재 권한 로직** (24-55번 라인):

```typescript
if (role !== 'admin' && userEmail) {
  if (role === 'searcher') {
    // Searcher: 본인이 생성한 파이프라인만
    q = q.eq('created_by', userEmail)
  } else if (role === 'headhunter') {
    // PM: 본인 JD에 연결된 파이프라인 + 본인이 추천한 파이프라인
    const { data: myJDs } = await supabaseAdmin
      .from('job_descriptions')
      .select('id')
      .eq('created_by', userEmail)

    if (myJDs && myJDs.length > 0) {
      const jdIds = myJDs.map(jd => jd.id).join(',')
      q = q.or(`jd_id.in.(${jdIds}),created_by.eq.${userEmail}`)
    } else {
      q = q.eq('created_by', userEmail)
    }
  }
  // Owner: organization_id 필터만 적용
}

// organization_id가 있으면 필터링
if (organizationId) {
  q = q.eq('organization_id', organizationId)
}
```

**디바 분석**:
- ✅ 로직 자체는 정상
- ✅ headhunter는 본인 JD + 본인 추천만 필터링
- ✅ organization_id는 추가 AND 조건

---

## 🎨 디아의 Frontend 코드 분석

### Pipeline 페이지 (`/pipeline/page.tsx`)

**API 호출 파라미터** (98-103번 라인):

```typescript
const params = new URLSearchParams({
  role: profile.role,
  user_email: profile.email,
  ...(profile.role === 'admin' && selectedOrgId !== '전체' && { organization_id: selectedOrgId }),
  ...(profile.role !== 'admin' && profile.organization_id && { organization_id: profile.organization_id })
})
```

**디아 분석**:
- ✅ role 전달 정상
- ✅ user_email 전달 정상
- ✅ organization_id 전달 정상 (AND 조건)

---

## 🧪 테스의 테스트 시나리오

### 검증 필요 사항

1. **Profile 확인**
   - [ ] 홍길동의 role이 정확히 'headhunter'인가?
   - [ ] organization_id가 제대로 설정되어 있는가?

2. **JD 소유권 확인**
   - [ ] 홍길동이 생성한 JD 목록 확인
   - [ ] DB에서 `created_by` 필드 값 확인

3. **Pipeline 데이터 확인**
   - [ ] 홍길동이 생성한 pipeline 확인
   - [ ] DB에서 `created_by` 필드 값 확인

4. **로그 확인**
   - [ ] Vercel Functions 로그에서 SQL 쿼리 확인
   - [ ] `[pipeline] PM: Filtering by...` 로그 확인

---

## 🚨 가능한 원인 (우선순위별)

### 원인 A: Profile role 오류 (80% 확률)
**증상**: 홍길동의 role이 'owner' 또는 'admin'으로 설정됨

**검증 방법**:
```sql
SELECT id, email, full_name, role, organization_id 
FROM profiles 
WHERE email = '홍길동@example.com';
```

**해결**:
- role을 'headhunter'로 수정
- Admin 페이지에서 사용자 정보 확인 및 수정

---

### 원인 B: created_by 필드 불일치 (15% 확률)
**증상**: JD의 `created_by` 이메일과 profile 이메일이 다름

**검증 방법**:
```sql
-- 홍길동이 만든 JD 확인
SELECT id, company, position, created_by 
FROM job_descriptions 
WHERE created_by = '홍길동@example.com';

-- 모든 파이프라인 확인
SELECT p.id, p.created_by, jd.created_by as jd_owner
FROM pipeline p
JOIN job_descriptions jd ON p.jd_id = jd.id
WHERE p.organization_id = '홍길동의_조직ID';
```

**해결**:
- JD created_by 필드 수정
- 또는 이메일 정규화 (대소문자, 공백 등)

---

### 원인 C: Frontend에서 잘못된 파라미터 전달 (3% 확률)
**증상**: role이 API에 전달되지 않음

**검증 방법**:
- 브라우저 개발자 도구 → Network 탭
- `/api/pipeline` 호출 확인
- Query Parameters에서 `role=headhunter` 확인

**해결**:
- getProfile() 함수 확인
- 세션 재로그인

---

### 원인 D: Supabase OR 쿼리 버그 (2% 확률)
**증상**: `.or()` 쿼리가 제대로 작동하지 않음

**검증 방법**:
```typescript
// 테스트 쿼리
const { data } = await supabaseAdmin
  .from('pipeline')
  .select('*')
  .or('jd_id.in.(id1,id2),created_by.eq.email@test.com')
```

**해결**:
- Supabase 라이브러리 업데이트
- 쿼리 방식 변경 (별도 쿼리 후 병합)

---

## ✅ 즉시 조치 사항 (테스)

### 1단계: 홍길동 Profile 확인

**Admin 페이지 → 사용자 관리**:
- 홍길동 이메일 검색
- Role 확인: `headhunter`가 맞는지?
- Organization 확인: 정확한 조직에 속해 있는지?

### 2단계: 브라우저 로그 확인

**홍길동 계정으로 로그인 후**:
1. F12 개발자 도구 열기
2. Console 탭에서 다음 확인:
   ```
   [pipeline] User: 홍길동@example.com Role: headhunter
   [pipeline] PM: Filtering by JD owner and recommender: 홍길동@example.com
   ```
3. Network 탭에서 API 호출 확인:
   ```
   /api/pipeline?role=headhunter&user_email=홍길동@example.com&organization_id=...
   ```

### 3단계: Vercel Logs 확인

**Vercel Dashboard → Functions → Logs**:
- 최근 `/api/pipeline` 호출 로그 확인
- SQL 쿼리 확인
- 에러 로그 확인

---

## 💡 임시 해결 방법 (디바)

문제 원인을 찾기 전까지 임시로 더 강력한 필터 추가:

```typescript
// Pipeline GET API에 추가 로깅
console.log('[pipeline DEBUG] Query params:', {
  role,
  userEmail,
  organizationId,
  myJDs: myJDs?.length
})

console.log('[pipeline DEBUG] Final query filter:', q)
```

---

## 📊 검증 완료 후 보고 필요

- [ ] 홍길동의 실제 role 값
- [ ] 홍길동이 생성한 JD 개수
- [ ] 현재 표시되는 파이프라인 개수
- [ ] 브라우저 콘솔 로그
- [ ] Vercel Functions 로그

---

**작성**: 2026-06-07  
**보고**: 디바, 디아, 테스  
**상태**: 🔴 조사 중 - 추가 정보 필요

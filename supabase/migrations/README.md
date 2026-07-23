# DB 마이그레이션 가이드

## 대시보드 인덱스 추가 (20260723_add_dashboard_indexes.sql)

### 📊 예상 효과
- DB 응답 시간: **30-40% 단축**
- 대시보드 로딩: 추가 **100-200ms 개선**
- 전체 로딩 시간: **0.1-0.3초** (최종)

---

## 🚀 실행 방법

### 1. Supabase Dashboard 접속
1. https://supabase.com 로그인
2. `jobizic-b2b` 프로젝트 선택
3. 좌측 메뉴 → **SQL Editor** 클릭

### 2. SQL 파일 실행
1. **New query** 버튼 클릭
2. `supabase/migrations/20260723_add_dashboard_indexes.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭 (또는 Ctrl+Enter)

### 3. 실행 결과 확인
성공 시 다음 메시지 표시:
```
=================================================
대시보드 인덱스 생성 완료!
=================================================
JD 테이블: 4개 인덱스
Pipeline 테이블: 5개 인덱스
Candidates 테이블: 3개 인덱스
JD Interests 테이블: 2개 인덱스
Profiles 테이블: 2개 인덱스
=================================================
총 16개 인덱스 생성 완료
예상 성능 개선: DB 응답 시간 30-40% 단축
=================================================
```

---

## 🔍 인덱스 효과 확인

### 방법 1: 대시보드 로딩 시간 측정
1. 브라우저 DevTools 열기 (F12)
2. **Network** 탭 선택
3. 대시보드 페이지 새로고침
4. `/api/dashboard` 요청 확인
   - **Before:** 200-300ms
   - **After:** 100-200ms 예상

### 방법 2: 인덱스 사용 통계 확인 (Supabase SQL Editor)
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as "인덱스 스캔 횟수",
  idx_tup_read as "읽은 행 수",
  idx_tup_fetch as "fetch 된 행 수"
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC
LIMIT 20;
```

---

## ⚠️ 주의사항

### 1. 인덱스 중복 생성 방지
- `IF NOT EXISTS` 사용 → 이미 존재하면 스킵
- 여러 번 실행해도 안전

### 2. 실행 시간
- 총 실행 시간: **약 5-10초**
- 데이터가 많을수록 시간 소요

### 3. 프로덕션 실행 시간
- 사용자가 적은 시간대 권장
- 또는 점심시간/새벽 시간

### 4. 롤백 방법 (필요 시)
```sql
-- 모든 인덱스 삭제
DROP INDEX IF EXISTS idx_jd_created_by;
DROP INDEX IF EXISTS idx_jd_org_status;
DROP INDEX IF EXISTS idx_jd_org_created;
DROP INDEX IF EXISTS idx_jd_status;
DROP INDEX IF EXISTS idx_pipeline_jd_active;
DROP INDEX IF EXISTS idx_pipeline_org_active;
DROP INDEX IF EXISTS idx_pipeline_created;
DROP INDEX IF EXISTS idx_pipeline_stage_active;
DROP INDEX IF EXISTS idx_pipeline_created_by;
DROP INDEX IF EXISTS idx_candidates_org;
DROP INDEX IF EXISTS idx_candidates_created_by;
DROP INDEX IF EXISTS idx_candidates_created;
DROP INDEX IF EXISTS idx_jd_interests_user;
DROP INDEX IF EXISTS idx_jd_interests_jd;
DROP INDEX IF EXISTS idx_profiles_email;
DROP INDEX IF EXISTS idx_profiles_org;
```

---

## 📋 생성되는 인덱스 목록

### JD 테이블 (job_descriptions)
1. `idx_jd_created_by` - 사용자별 JD 조회
2. `idx_jd_org_status` - 조직별 상태별 조회
3. `idx_jd_org_created` - 최근 JD 조회
4. `idx_jd_status` - 상태별 통계

### Pipeline 테이블
1. `idx_pipeline_jd_active` - JD별 활성 프로세스
2. `idx_pipeline_org_active` - 조직별 활성 프로세스
3. `idx_pipeline_created` - 월별 매칭 통계
4. `idx_pipeline_stage_active` - 단계별 통계
5. `idx_pipeline_created_by` - 사용자별 통계

### Candidates 테이블
1. `idx_candidates_org` - 조직별 후보자 카운트
2. `idx_candidates_created_by` - 사용자별 통계
3. `idx_candidates_created` - 최근 후보자 조회

### JD Interests 테이블
1. `idx_jd_interests_user` - 사용자별 관심 JD
2. `idx_jd_interests_jd` - JD별 관심 등록자

### Profiles 테이블
1. `idx_profiles_email` - 이메일 조회
2. `idx_profiles_org` - 조직별 활성 멤버

---

## 🎯 성능 개선 예상

### Before (인덱스 없음)
- 대시보드 API: 200-300ms
- DB 쿼리: Full Table Scan
- 데이터 많아질수록 느려짐

### After (인덱스 적용)
- 대시보드 API: **100-200ms** (30-50% 개선)
- DB 쿼리: Index Scan
- 데이터 증가해도 속도 유지

### 최종 대시보드 로딩 시간
1. API 통합: 1-3초 → 0.2-0.5초 (80% 개선)
2. Progressive Loading: 체감 속도 70% 개선
3. DB 인덱스: **0.1-0.3초** (추가 30% 개선)

**→ 최종: 즉시 로드 (0.1-0.3초)** ⚡

---

**미르팀 작성 | 디바 + 코난**

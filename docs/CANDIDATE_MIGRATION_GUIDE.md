# 후보자 데이터 마이그레이션 가이드

headhunter-app → Eve(jobizic_b2b) 후보자 데이터 마이그레이션

---

## 🎯 개요

headhunter-app의 SQLite 데이터베이스(`candidates.db`)에서 Eve(Supabase)로 후보자 데이터를 마이그레이션합니다.

**마이그레이션 후:**
- ✅ Eve에서 모든 후보자 데이터 관리
- ✅ JD 자동 매칭 가능
- ✅ Adam/headhunter-app/Eve 출처 구분

---

## 📊 출처 구분 방식

### `source` 필드

| 값 | 의미 | 원본 시스템 | 표시 |
|---|------|-------------|------|
| `'B2C'` | Adam(B2C)에서 등록 | Adam | 🔵 B2C |
| `'Local'` | headhunter-app에서 마이그레이션 | headhunter-app | 🟢 Local |
| `'B2B'` | Eve(B2B)에서 직접 등록 | Eve | 🟣 B2B |

### `metadata` JSONB

```json
{
  "imported_from": "Local",
  "original_id": 123,
  "imported_at": "2026-07-21T14:30:00Z",
  "original_data": {
    "birth_date": "1990-01-01",
    "last_salary": 5000,
    "resume_path": "/path/to/resume.pdf",
    "verify_date": "2026-07-01"
  }
}
```

---

## 🔄 데이터 매핑

| headhunter-app | Eve | 변환 |
|----------------|-----|------|
| `id` | `metadata.original_id` | 추적용 |
| `name` | `name` | 직접 |
| `email` | `email` | 직접 |
| `phone` | `phone` | 직접 |
| `position` | `current_position` | 직접 |
| `career` | `career_summary` | 직접 |
| `university` | `education` | 문자열 → 배열 |
| `desired_salary` | `desired_salary` | 숫자 → 문자열 |
| `keywords` | `skills` | 쉼표 분리 → 배열 |
| `status` | `status` | 매핑 (아래 참고) |
| `notes` | `headhunter_notes` | 직접 |
| `bizcard_analysis` | `raw_resume` | 직접 |
| `career_direction` | `career_trajectory` | JSON 파싱 |
| `verify_summary` | `strength_summary` | 직접 |
| `verify_grade` | `market_value` | 직접 |

### 상태 매핑

| headhunter-app | Eve |
|----------------|-----|
| 진행중 | 활성 |
| 검토중 | 검토중 |
| 제안중 | 제안중 |
| 합격 | 합격 |
| 보류 | 보류 |
| 종료 | 아카이브 |
| 탈락 | 아카이브 |

---

## 📋 사전 준비

### 1. better-sqlite3 설치

```bash
npm install better-sqlite3
```

### 2. 환경변수 확인

`.env.local`에 다음 변수가 설정되어 있는지 확인:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

### 3. headhunter-app 경로 확인

스크립트의 기본 경로:
```
C:\project\headhunter-app\public\data\candidates.db
```

다른 경로라면 스크립트 수정 필요:
```javascript
// scripts/migrate-candidates-from-headhunter-app.js
const HEADHUNTER_APP_DB_PATH = '/your/custom/path/candidates.db'
```

---

## 🚀 실행 방법

### 1단계: DRY RUN (테스트)

**실제로 insert하지 않고 미리보기:**

```bash
npm run migrate:candidates:dry-run
```

**출력 예시:**
```
🚀 headhunter-app → Eve 후보자 데이터 마이그레이션 시작
============================================================
⚠️  DRY RUN 모드: 실제로 데이터를 insert하지 않습니다

1️⃣  SQLite 데이터베이스 연결 중...
✅ 연결 성공: C:\project\headhunter-app\public\data\candidates.db

2️⃣  후보자 데이터 조회 중...
✅ 총 150명의 후보자 발견

3️⃣  기존 마이그레이션 데이터 확인 중...
ℹ️  기존 마이그레이션 데이터: 0명

4️⃣  데이터 변환 및 마이그레이션 중...

📋 [ID 1] 홍길동 (hong@example.com)
   변환된 데이터: {
     "name": "홍길동",
     "email": "hong@example.com",
     "source": "headhunter-app",
     ...
   }

...

============================================================
📊 마이그레이션 결과 요약
============================================================
✅ 성공: 150명
⏭️  스킵 (중복): 0명
❌ 실패: 0명
📝 총 처리: 150명

⚠️  DRY RUN 모드였습니다. 실제로 데이터가 insert되지 않았습니다.
```

### 2단계: 실제 마이그레이션

**DRY RUN 결과 확인 후 실행:**

```bash
npm run migrate:candidates
```

**주의:**
- ⚠️ 이메일이 같으면 스킵됩니다 (중복 방지)
- ⚠️ 한 번 실행하면 되돌릴 수 없습니다
- ⚠️ 백업 권장!

---

## 🔍 마이그레이션 후 확인

### 1. Supabase에서 확인

```sql
-- 마이그레이션된 후보자 조회
SELECT id, name, email, source, created_at
FROM candidates
WHERE source = 'Local'
ORDER BY created_at DESC;

-- 출처별 통계
SELECT source, COUNT(*) as count
FROM candidates
GROUP BY source;

-- 예상 결과:
-- B2C     | 50    (Adam)
-- Local   | 150   (headhunter-app)
-- B2B     | 20    (Eve)
```

### 2. Eve UI에서 확인

1. http://localhost:3000/candidates (구현 예정)
2. 필터: source = 'Local'
3. 뱃지 표시: 🟢 Local

---

## 🛡️ 중복 방지

### 이메일 기반 중복 확인

- 같은 이메일이 이미 존재하면 **스킵**
- 로그 출력: `⏭️  [ID 123] 스킵 (이메일 중복: xxx@example.com)`

### 재실행 시

- 이미 마이그레이션된 데이터는 스킵됨
- 새로운 데이터만 추가됨

---

## 🔧 문제 해결

### SQLite 데이터베이스를 찾을 수 없습니다

**에러:**
```
❌ 연결 실패: unable to open database file
```

**해결:**
1. headhunter-app 경로 확인
2. 스크립트의 `HEADHUNTER_APP_DB_PATH` 수정

### better-sqlite3 설치 오류

**에러:**
```
Cannot find module 'better-sqlite3'
```

**해결:**
```bash
npm install better-sqlite3
```

### Supabase 연결 오류

**에러:**
```
❌ 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL
```

**해결:**
`.env.local` 파일 확인 및 서버 재시작

---

## 📊 예상 결과

**150명 마이그레이션 시:**
- ⏱️ 소요 시간: 약 2-3분
- 💾 데이터 크기: 약 500KB
- 📈 성공률: 95%+ (이메일 중복 제외)

---

## 🎯 다음 단계

### 1. Adam 후보자도 구분

Adam에서 등록된 후보자의 `source`를 `'B2C'`로 설정:

```sql
-- Adam 연동 시 source 설정
INSERT INTO candidates (
  name, email, source, ...
) VALUES (
  '홍길동', 'hong@example.com', 'B2C', ...
);
```

### 2. UI에서 출처 필터링

```typescript
// 필터 옵션
<select>
  <option value="all">전체</option>
  <option value="B2C">🔵 B2C (Adam)</option>
  <option value="Local">🟢 Local (headhunter-app)</option>
  <option value="B2B">🟣 B2B (Eve)</option>
</select>
```

### 3. JD 자동 매칭

마이그레이션된 후보자를 JD와 자동 매칭!

---

## 📚 관련 문서

- [supabase_candidates_schema.sql](../supabase_candidates_schema.sql)
- [scripts/migrate-candidates-from-headhunter-app.js](../scripts/migrate-candidates-from-headhunter-app.js)

# 텔레그램 URL 이슈 긴급 회의 보고서

**일시**: 2026-06-07  
**참석자**: 디바 (Backend 총괄), 디아 (Frontend), 테스 (QA)  
**이슈**: 텔레그램 "웹에서 보기" 버튼이 `https://jobizic-b2b.vercel.app`로 이동하는 문제

---

## 🔴 문제 요약

**현상**: 텔레그램 봇 `/today`, `/pipeline` 명령어의 "웹에서 보기" 버튼 클릭 시 잘못된 도메인으로 이동
- **기대값**: `https://jobizic-biz.vercel.app/` (biz 포함)
- **실제값**: `https://jobizic-b2b.vercel.app` (b2b, trailing slash 없음)

---

## 🔍 근본 원인 분석 (디바)

### 1. Git 히스토리 조사 결과

```bash
615178c Fix: Use NEXT_PUBLIC_APP_URL for Telegram 'View in Web' buttons
2428055 Fix: Hardcode correct domain bypassing env var  ← 🚨 의심 커밋
91ecc7a Fix: Correct domain in Telegram webhook buttons
```

**커밋 `2428055` 분석**:
- 이전 커밋에서 URL이 **하드코딩**되어 있었음
- `/today`: `https://jobizic-biz.vercel.app` (trailing slash 없음)
- `/pipeline`: `https://jobizic-biz.vercel.app/pipeline`

**현재 코드 (615178c)**:
```typescript
// Line 274
url: process.env.NEXT_PUBLIC_APP_URL || 'https://jobizic-biz.vercel.app/'

// Line 329
url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://jobizic-biz.vercel.app'}/pipeline`
```

### 2. 환경변수 확인

**Vercel Dashboard 설정**:
- ✅ `NEXT_PUBLIC_APP_URL` 존재 (방금 추가)
- ⚠️ **값 확인 필요**: Vercel에서 실제로 어떤 값이 설정되어 있는가?

### 3. 가능한 원인 3가지

#### 원인 A: Vercel 환경변수 값이 잘못됨 (90% 확률)
```
설정된 값: https://jobizic-b2b.vercel.app  ← 잘못된 값
올바른 값: https://jobizic-biz.vercel.app/ ← 올바른 값
```

**검증 방법**:
1. Vercel Dashboard → jobizic-b2b → Settings → Environment Variables
2. `NEXT_PUBLIC_APP_URL` 클릭
3. 값 확인: `b2b` vs `biz`

#### 원인 B: 배포 후 Vercel 재시작 필요 (5% 확률)
- 환경변수 추가 후 자동 재배포가 안 됨
- **해결**: Vercel Dashboard → Deployments → Redeploy

#### 원인 C: 클라이언트 캐싱 (5% 확률)
- 텔레그램 봇이 오래된 응답을 캐싱
- **해결**: 봇 재시작 또는 `/setWebhook` 재설정

---

## 🧪 테스트 시나리오 (테스)

### 현재 상황 재현
1. ✅ 텔레그램 봇에서 `/today` 입력
2. ✅ "웹에서 보기" 버튼 클릭
3. ❌ `https://jobizic-b2b.vercel.app`으로 이동 (잘못됨)

### 검증 체크리스트

#### 1단계: Vercel 환경변수 확인
- [ ] `NEXT_PUBLIC_APP_URL` 값이 `https://jobizic-biz.vercel.app/`인지 확인
- [ ] Production, Preview, Development 모두 체크되어 있는지 확인

#### 2단계: 수정 후 재배포
- [ ] Vercel Dashboard → Deployments → 최신 배포 상태 확인
- [ ] Status = "Ready" 확인
- [ ] 배포 로그에서 환경변수 로드 확인

#### 3단계: 실제 테스트
- [ ] 텔레그램에서 `/today` 새로 입력 (기존 메시지 X)
- [ ] "웹에서 보기" 버튼 클릭
- [ ] URL이 `https://jobizic-biz.vercel.app/`인지 확인

#### 4단계: 회귀 테스트
- [ ] `/pipeline` 명령어 → `https://jobizic-biz.vercel.app/pipeline` 확인
- [ ] `/help` 명령어 정상 동작 확인
- [ ] 계정 연동 Deep Link 정상 동작 확인

---

## 🛠 즉시 조치 사항 (디바)

### 조치 1: Vercel 환경변수 값 확인 및 수정

**현재 추정값** (잘못됨):
```
NEXT_PUBLIC_APP_URL = https://jobizic-b2b.vercel.app
```

**올바른 값**:
```
NEXT_PUBLIC_APP_URL = https://jobizic-biz.vercel.app/
```

**주의사항**:
- ⚠️ `b2b` → `biz` (철자 차이)
- ⚠️ 끝에 `/` 포함 (trailing slash)

### 조치 2: 재배포 트리거

환경변수 수정 후:
1. Vercel Dashboard → Deployments 탭
2. 최신 배포 선택 → `...` 메뉴 → **Redeploy**
3. 또는 더미 커밋 후 `git push origin main`

### 조치 3: 텔레그램 Webhook 재설정 (선택사항)

만약 위 조치로 해결 안 되면:
```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

그 후 앱에서 `/api/telegram/setup` 재호출

---

## 💡 Frontend 관점 (디아)

### UI/UX 개선 제안

현재 텔레그램 메시지는 URL이 노출되지 않아, 사용자가 잘못된 도메인으로 가는지 인지 불가.

**개선안**:
1. **Admin 페이지에 텔레그램 설정 상태 표시**
   - 현재 Webhook URL 표시
   - "웹에서 보기" 버튼 테스트 기능

2. **개발자 모드 추가**
   - 텔레그램 메시지에 URL 미리보기 포함
   - 환경변수 값 확인 UI

---

## 📋 재발 방지 대책 (디바 + 테스)

### 1. 환경변수 문서화 강화

**작업**: `Documents/DEPLOYMENT_GUIDE.md`에 추가
```markdown
### 텔레그램 관련 환경변수

NEXT_PUBLIC_APP_URL=https://jobizic-biz.vercel.app/
  - 용도: 텔레그램 "웹에서 보기" 버튼 URL
  - 주의: 반드시 'biz' (b2b 아님), trailing slash 포함
  - 테스트: /today 명령어로 확인
```

### 2. 환경변수 검증 스크립트 추가

**파일**: `scripts/verify-env.ts`
```typescript
// Vercel 배포 전 자동 검증
if (process.env.NEXT_PUBLIC_APP_URL !== 'https://jobizic-biz.vercel.app/') {
  throw new Error('Invalid NEXT_PUBLIC_APP_URL')
}
```

### 3. CI/CD 체크리스트

**Vercel 배포 전 자동 체크**:
- [ ] `NEXT_PUBLIC_APP_URL` 값 검증
- [ ] `/api/telegram/webhook` 라우트 빌드 성공
- [ ] 환경변수 모든 Environment에 설정됨

### 4. QA 테스트 자동화 (테스)

**통합 테스트 추가**:
```typescript
// tests/telegram-url.test.ts
test('Telegram webhook buttons should use correct domain', () => {
  const expectedDomain = 'https://jobizic-biz.vercel.app/'
  // Mock telegram message
  // Assert button URL
})
```

---

## 📊 타임라인

### 발견 (2026-06-07 오후)
- 사용자 리포트: 텔레그램 "웹에서 보기" 버튼 URL 오류

### 1차 수정 시도 (오후 3:00)
- 커밋 `615178c`: 환경변수 사용하도록 코드 수정
- Vercel 환경변수 추가 (`NEXT_PUBLIC_APP_URL`)

### 긴급 회의 (오후 3:30)
- 디바, 디아, 테스 참석
- 근본 원인 분석: **환경변수 값 오타 추정**

### 조치 예정 (오후 4:00)
- [ ] Vercel 환경변수 값 확인 및 수정
- [ ] 재배포 및 테스트
- [ ] QA 검증 (테스)

---

## ✅ 최종 체크리스트

### 디바 (Backend 총괄)
- [ ] Vercel `NEXT_PUBLIC_APP_URL` 값 확인: `https://jobizic-biz.vercel.app/`
- [ ] 환경변수 수정 후 Redeploy
- [ ] Vercel 배포 로그 확인 (환경변수 로드 성공)
- [ ] 문서 업데이트 (DEPLOYMENT_GUIDE.md)

### 테스 (QA)
- [ ] 재배포 후 `/today` 명령어 테스트
- [ ] 재배포 후 `/pipeline` 명령어 테스트
- [ ] URL이 `https://jobizic-biz.vercel.app/`인지 확인
- [ ] 회귀 테스트 (계정 연동, 기타 명령어)

### 디아 (Frontend)
- [ ] Admin 페이지에 텔레그램 설정 상태 UI 추가 (선택)
- [ ] 환경변수 검증 UI 추가 (선택)

---

## 🚨 긴급 연락

**디바 조치 완료 후 보고 필요**:
1. Vercel 환경변수 값 확인 결과
2. 재배포 상태
3. 테스트 결과

**테스 검증 완료 후 보고 필요**:
1. QA 체크리스트 통과 여부
2. 발견된 추가 이슈

---

**작성**: 2026-06-07 오후 3:40  
**보고자**: 디바 (S/W 총괄)  
**검토**: 디아 (Frontend), 테스 (QA)  
**상태**: ⚠️ 긴급 조치 대기 중

# Vercel 환경 변수 설정 가이드

## 🔐 암호화 키 설정

### 1. 키 확인

로컬 `.env.local` 파일에서 키 확인:

```bash
cat .env.local
```

출력:
```
ENCRYPTION_KEY=orVu2271PbtrN/FSOKrjxnEjRs+KeW107G/VfNPVbyY=
ENCRYPTION_SALT=30prT7R2eJVsQG4e1Fs/Gg==
```

### 2. Vercel Dashboard 설정

1. **Vercel Dashboard 접속**
   ```
   https://vercel.com/dashboard
   ```

2. **프로젝트 선택**
   - `jobizic-b2b` 프로젝트 클릭

3. **Settings → Environment Variables**
   ```
   프로젝트 → Settings → Environment Variables
   ```

4. **변수 추가**

   **첫 번째 변수:**
   - Name: `ENCRYPTION_KEY`
   - Value: `orVu2271PbtrN/FSOKrjxnEjRs+KeW107G/VfNPVbyY=`
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - [Add] 클릭

   **두 번째 변수:**
   - Name: `ENCRYPTION_SALT`
   - Value: `30prT7R2eJVsQG4e1Fs/Gg==`
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - [Add] 클릭

5. **재배포**

   환경 변수 추가 후 자동으로 재배포되지 않으므로:
   
   ```
   Deployments → 최신 배포 → ... → Redeploy
   ```

---

## 📊 기타 환경 변수

### Supabase

이미 설정되어 있음:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Anthropic API

이미 설정되어 있음:
- `ANTHROPIC_API_KEY`

### 추가 필요 (선택)

**Sentry (에러 모니터링)**
```
SENTRY_DSN=https://...
```

**Telegram (알림)**
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

---

## ✅ 확인 방법

### 1. 로컬 테스트

```bash
npm run dev
```

브라우저에서 확인:
```
http://localhost:3000
```

개발자 도구 → Console에서 에러 없는지 확인

### 2. 배포 확인

Vercel 배포 로그 확인:
```
Deployments → 최신 배포 → View Function Logs
```

암호화 관련 에러 없는지 확인

### 3. 기능 테스트

1. 후보자 등록 (이력서 업로드)
2. 개인정보 암호화 확인
3. 복호화 정상 작동 확인

---

## ⚠️ 보안 주의사항

### DO ✅

- ✅ 암호화 키를 안전한 곳에 백업 (Password Manager)
- ✅ 환경 변수는 Vercel Dashboard에서만 관리
- ✅ 키 변경 시 기존 데이터 마이그레이션 필요

### DON'T ❌

- ❌ 암호화 키를 Git에 커밋
- ❌ 암호화 키를 Slack/이메일로 공유
- ❌ 암호화 키를 코드에 하드코딩
- ❌ 프로덕션과 개발 환경에서 같은 키 사용 (권장하지 않음)

---

## 🔄 키 교체 (필요 시)

### 1. 새 키 생성

```bash
npm run generate:keys
```

### 2. 기존 데이터 마이그레이션

**주의:** 기존 암호화 데이터를 복호화하고 새 키로 재암호화 필요

```bash
# 마이그레이션 스크립트 (추후 작성 필요)
node scripts/migrate-encryption-key.js
```

### 3. Vercel 환경 변수 업데이트

### 4. 재배포

---

## 📞 문제 해결

### 에러: "ENCRYPTION_KEY not set"

**원인:** 환경 변수가 설정되지 않음

**해결:**
1. Vercel Dashboard 확인
2. 환경 변수 추가
3. 재배포

### 에러: "암호화 실패"

**원인:** 키 길이가 부족하거나 형식이 잘못됨

**해결:**
1. `npm run generate:keys`로 새 키 생성
2. Vercel 환경 변수 업데이트

### 에러: "복호화 실패"

**원인:** 잘못된 키 또는 데이터 손상

**해결:**
1. 환경 변수가 올바른지 확인
2. 키가 변경되었다면 마이그레이션 필요

---

## 📚 참고 문서

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Node.js Crypto](https://nodejs.org/api/crypto.html)

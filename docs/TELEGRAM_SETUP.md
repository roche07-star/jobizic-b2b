# 텔레그램 봇 설정 가이드

Jobizic B2B에 텔레그램 봇을 연동하여 실시간 알림을 받을 수 있습니다.

## 🎯 기능

- ✅ 신규 JD 등록 알림
- ✅ 채용 프로세스 단계 변경 알림
- ✅ 모닝 브리핑 (매일 오전 9시)
- ✅ `/today` - 오늘 할 일 조회
- ✅ `/pipeline` - 채용 프로세스 현황

---

## 📱 1단계: 봇 생성 (관리자 1회)

### 1-1. BotFather 접속

```
텔레그램 앱 실행
→ 검색: @BotFather
→ 시작
```

### 1-2. 봇 생성

```
/newbot

Bot name: Jobizic Recruiter
Username: jobizic_recruiter_bot
```

### 1-3. 토큰 복사

```
Use this token to access the HTTP API:
123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567
          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
          이 토큰을 복사하세요!
```

---

## ⚙️ 2단계: 환경 변수 설정

### 2-1. .env.local 파일에 추가

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567
TELEGRAM_BOT_USERNAME=jobizic_recruiter_bot
TELEGRAM_SECRET_TOKEN=your_random_secret_here
```

**TELEGRAM_SECRET_TOKEN 생성**:
- 랜덤 문자열 (32자 이상 권장)
- 생성 방법: `openssl rand -hex 32` 또는 UUID 사용

### 2-2. Vercel 환경 변수 등록 ⚠️ 필수!

**Vercel Dashboard에서 설정**:

```
1. https://vercel.com → 프로젝트 선택
2. Settings → Environment Variables
3. 다음 3개 추가:

   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_BOT_USERNAME=jobizic_recruiter_bot
   TELEGRAM_SECRET_TOKEN=로컬과_동일한_값

4. Environment: Production, Preview, Development 모두 선택
5. Save → 재배포 (git push 또는 Redeploy)
```

**또는 CLI 사용**:

```bash
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_BOT_USERNAME
vercel env add TELEGRAM_SECRET_TOKEN
```

⚠️ **환경 변수 추가 후 반드시 재배포해야 적용됩니다!**

---

## 🗄️ 3단계: DB 마이그레이션

### Supabase SQL Editor에서 실행

```sql
-- migrations/add_telegram_integration.sql 파일 내용 복사 후 실행
```

또는 파일 실행:

```bash
# Supabase CLI 사용
supabase db push
```

---

## 🚀 4단계: 웹훅 설정

### 4-1. 자동 설정 (추천)

관리자 계정으로 로그인 후:

```
POST /api/telegram/setup
```

또는 웹 인터페이스에서 "텔레그램 봇 설정" 버튼 클릭

### 4-2. 수동 설정

```bash
curl -X POST https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.vercel.app/api/telegram/webhook",
    "secret_token": "your_secret_token"
  }'
```

---

## 👥 5단계: 사용자 연동

### 사용자가 할 일 (10초!)

1. 웹앱 로그인
2. "텔레그램 연동" 버튼 클릭
3. 텔레그램 앱 자동 실행
4. 자동 연동 완료! ✅

---

## 🧪 테스트

### 1. 봇 정보 확인

```bash
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
```

### 2. 웹훅 상태 확인

```bash
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
```

### 3. 테스트 메시지 전송

텔레그램에서 봇 검색 → `/start` 명령어

---

## 📊 알림 종류

### 즉시 알림

- 신규 JD 파싱 완료
- 채용 단계 변경
- 매칭 완료

### 정기 알림 (Cron)

- 모닝 브리핑 (매일 9시)

---

## 🔧 트러블슈팅

### 봇이 응답하지 않음

1. 토큰 확인: `getMe` API 호출
2. 웹훅 확인: `getWebhookInfo` API 호출
3. 로그 확인: Vercel 로그 또는 Supabase 로그

### 알림이 오지 않음

1. 계정 연동 확인: DB에서 `telegram_chat_id` 확인
2. 권한 확인: 사용자 role 확인
3. 함수 호출 확인: `sendTelegramMessage` 호출 여부

### Webhook URL이 유효하지 않음

- Vercel 배포 URL 확인
- HTTPS 필수 (HTTP 불가)
- Public 접근 가능 여부 확인

---

## 📝 커스터마이징

### 알림 메시지 수정

`app/api/telegram/webhook/route.ts` 파일에서 메시지 템플릿 수정

### 새 명령어 추가

1. `handleMessage` 함수에 명령어 추가
2. `setMyCommands`에 명령어 등록

### 이벤트 알림 추가

```typescript
import { sendMessageToUser } from '@/lib/telegram'

// JD 파싱 완료 시
await sendMessageToUser(
  jdOwnerEmail,
  `🆕 새로운 JD가 등록되었습니다!\n\n${company} - ${position}`
)
```

---

## 🔒 보안

- ✅ Webhook Secret Token 검증
- ✅ 개인정보 최소화 (상세는 웹 링크)
- ✅ Role 기반 권한 제어
- ✅ HTTPS 필수

---

## 📚 참고 자료

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Deep Links](https://core.telegram.org/bots/features#deep-linking)

---

## ✅ 완료 체크리스트

- [ ] BotFather에서 봇 생성
- [ ] 환경 변수 설정 (.env.local + Vercel)
- [ ] DB 마이그레이션 실행
- [ ] Webhook 설정 (/api/telegram/setup)
- [ ] 테스트 계정 연동
- [ ] /start, /today, /pipeline 테스트
- [ ] 알림 테스트 (신규 JD 등록)

---

**설정 완료 시간**: 약 10-15분 ⏱️

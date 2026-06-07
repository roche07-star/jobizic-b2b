# 텔레그램 알림 안 오는 문제 디버깅 체크리스트

**일시**: 2026-06-08  
**참석자**: 디바, 디아, 테스  
**이슈**: 단계 변경해도 텔레그램 보고가 안 됨

---

## ✅ 체크리스트 (순서대로 확인)

### 1. Vercel 배포 상태 확인 ⚠️

**가능성**: 방금 커밋한 코드가 아직 배포 안 됨!

**확인 방법**:
1. Vercel Dashboard → 프로젝트 선택
2. Deployments 탭 → 최근 배포 확인
3. 커밋 해시 확인: `c04428b`, `c2d38dc`
4. Status: ✅ Ready 인지 확인

**결과**:
- [ ] 최신 코드 배포 완료
- [ ] 배포 실패 (에러 로그 확인 필요)
- [ ] 배포 진행 중 (대기 필요)

---

### 2. Frontend updated_by 전달 확인

**가능성**: Frontend가 아직 구버전 (updated_by 안 보냄)

**확인 방법**:
1. 브라우저 강제 새로고침: `Ctrl + Shift + R` (캐시 클리어)
2. F12 → Network 탭 열기
3. 단계 변경 (예: 신규 → 1차면접)
4. PATCH `/api/pipeline/[id]` 요청 클릭
5. **Payload** 탭에서 확인:

```json
// ✅ 정상
{
  "stage": "1차면접",
  "updated_by": "user@example.com"
}

// ❌ 문제
{
  "stage": "1차면접"
  // updated_by 없음!
}
```

**결과**:
- [ ] updated_by 전달됨 (정상)
- [ ] updated_by 없음 (Frontend 배포 안 됨 or 캐시 문제)

---

### 3. Backend 로그 확인 (Vercel)

**확인 방법**:
1. Vercel Dashboard → Functions → Logs
2. 단계 변경 후 실시간 로그 확인
3. 다음 로그가 있는지 확인:

```
✅ [Pipeline PATCH] Stage change check: { hasStage: true, hasUpdatedBy: true, ... }
✅ [Pipeline PATCH] Stage changed: { oldStage: '신규', newStage: '1차면접', ... }
✅ [Pipeline PATCH] Telegram sent to recommender: hong@example.com
```

**만약 이 로그가 없으면**:
```
❌ [Pipeline PATCH] Stage change check: { hasStage: true, hasUpdatedBy: false, ... }
→ Frontend에서 updated_by 안 보냄!
```

**결과**:
- [ ] 모든 로그 정상 출력
- [ ] "hasUpdatedBy: false" (Frontend 문제)
- [ ] "Stage changed" 로그 없음 (조건 실패)
- [ ] 로그 자체가 없음 (Backend 배포 안 됨)

---

### 4. 추천자 telegram_chat_id 확인

**가능성**: 추천자가 텔레그램 연동 안 함!

**확인 방법**:

#### Option A: Admin 페이지에서 확인
1. Admin 페이지 → 사용자 관리
2. 추천자 이메일 검색
3. "📱 Telegram" 배지 있는지 확인

#### Option B: DB 직접 확인
```sql
SELECT 
  email, 
  full_name, 
  telegram_chat_id, 
  telegram_username
FROM profiles
WHERE email = '추천자이메일@example.com';
```

**결과**:
- [ ] telegram_chat_id 있음 (값: `123456789`)
- [ ] telegram_chat_id NULL (연동 안 됨!)
- [ ] 사용자 자체가 없음 (이메일 오류)

---

### 5. 조건문 체크: 본인이 변경했나?

**가능성**: JD Owner가 본인이 추천한 후보자 단계 변경 → 텔레그램 안 감 (정상 동작)

**코드 로직**:
```typescript
if (oldPipeline.created_by !== updated_by) {
  // 추천자에게 텔레그램 전송
}
```

**시나리오**:
- 홍길동이 후보자 추천 (`oldPipeline.created_by = 'hong@example.com'`)
- 홍길동이 직접 단계 변경 (`updated_by = 'hong@example.com'`)
- 조건: `'hong@...' !== 'hong@...'` → **false** → 텔레그램 안 감!

**이유**: 본인이 변경한 건데 본인한테 알림 보낼 필요 없음 (정상 동작)

**테스트 방법**:
- **다른 사람**(JD Owner 또는 Admin)이 단계 변경해야 함!

**결과**:
- [ ] 추천자 ≠ 변경자 (텔레그램 가야 함)
- [ ] 추천자 = 변경자 (텔레그램 안 가는 게 정상)

---

### 6. Telegram Bot API 오류

**가능성**: sendTelegramMessage 함수 자체가 실패

**Vercel 로그에서 확인**:
```
❌ [Pipeline PATCH] Telegram send failed: Error: ...
```

**가능한 원인**:
- Bot Token 오류 (`TELEGRAM_BOT_TOKEN` 환경변수)
- Chat ID 형식 오류
- Telegram API 서버 장애

**결과**:
- [ ] 에러 로그 있음 (Bot Token 확인)
- [ ] 에러 로그 없음 (정상)

---

## 🧪 테스의 재현 시나리오

### 정상 작동 테스트

**준비**:
1. 사용자 A (PM): 후보자 추천 → telegram_chat_id 있음
2. 사용자 B (JD Owner): 단계 변경 권한 있음
3. A ≠ B (다른 사람)

**실행**:
1. A가 JD-후보자 매칭 (추천)
2. **B가** 채용 프로세스에서 단계 변경: 신규 → 1차면접
3. A의 텔레그램 확인

**예상 결과**:
- ✅ A에게 텔레그램 수신:
  ```
  👤 [1차면접]
  
  🏢 회사: ...
  💼 포지션: ...
  👤 후보자: ...
  ✍️ 추천자: A
  
  단계가 변경되었습니다! 🎉
  ```

---

### 실패 케이스 (정상 동작)

**시나리오**: 추천자가 본인이 추천한 후보자 단계 변경

**실행**:
1. A가 JD-후보자 매칭 (추천)
2. **A가** 직접 단계 변경
3. A의 텔레그램 확인

**예상 결과**:
- ✅ 텔레그램 **안 옴** (본인이 변경했으므로 정상)

---

## 💡 디바의 임시 조치

### 더 많은 디버그 로깅 추가

```typescript
// 추천자 조건 체크 전
console.log('[Pipeline PATCH] Recommender check:', {
  recommender: oldPipeline.created_by,
  updatedBy: updated_by,
  isSamePerson: oldPipeline.created_by === updated_by,
  hasProfile: !!profile
})

// 추천자 조회 후
console.log('[Pipeline PATCH] Recommender profile:', {
  email: recommender?.email,
  hasTelegramChatId: !!recommender?.telegram_chat_id,
  chatId: recommender?.telegram_chat_id
})
```

---

## 🚨 가장 가능성 높은 원인 (우선순위)

### 1. Vercel 배포 진행 중 (70% 확률)
- 방금 커밋한 코드가 아직 배포 안 됨
- **조치**: 5분 대기 후 재시도

### 2. 추천자 = 변경자 (20% 확률)
- 본인이 변경해서 텔레그램 안 감 (정상 동작)
- **조치**: 다른 사람이 변경해야 함

### 3. 추천자 telegram_chat_id 없음 (8% 확률)
- 추천자가 텔레그램 연동 안 함
- **조치**: /start 명령어로 봇 시작

### 4. 브라우저 캐시 (2% 확률)
- Frontend 구버전 로드됨
- **조치**: Ctrl+Shift+R (강제 새로고침)

---

## 📊 즉시 확인 사항

**지금 바로 확인**:
1. [ ] Vercel 배포 상태: https://vercel.com/dashboard
2. [ ] 브라우저 강제 새로고침: `Ctrl + Shift + R`
3. [ ] Network 탭에서 updated_by 전달 확인
4. [ ] 추천자의 Telegram 연동 상태 확인 (Admin 페이지)
5. [ ] **다른 사람**이 단계 변경 (본인 말고!)

---

**작성**: 2026-06-08  
**보고**: 디바, 디아, 테스  
**상태**: 🔴 긴급 디버깅 중  
**다음 단계**: 위 체크리스트 순서대로 확인 후 결과 보고

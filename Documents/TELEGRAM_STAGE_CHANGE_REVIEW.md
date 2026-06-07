# 단계 변경 텔레그램 알림 검토 보고

**일시**: 2026-06-07  
**참석자**: 디바 (Backend), 디아 (Frontend), 테스 (QA)  
**이슈**: JD Owner가 단계 변경 시 추천자에게 텔레그램이 안 가는 것 같음

---

## 🔍 디바의 코드 검토

### 현재 구현 (pipeline/[id]/route.ts, 140-172번 라인)

```typescript
// 3. 텔레그램 알림 - 추천자에게 (본인이 변경한 것이 아닌 경우)
if (oldPipeline.created_by && profile && oldPipeline.created_by !== updated_by) {
  const { data: recommender } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, telegram_chat_id')
    .eq('email', oldPipeline.created_by)
    .single()

  if (recommender?.telegram_chat_id) {
    try {
      const stageEmoji = getStageEmoji(stage)
      const recommenderName = recommender.full_name || oldPipeline.created_by.split('@')[0]

      const telegramMessage = `${stageEmoji} <b>[${stage}]</b>

🏢 회사: ${jd?.company || '회사명 미상'}
💼 포지션: ${jd?.position || '포지션명 미상'}
👤 후보자: ${candidate?.name || '후보자명 미상'}
✍️ 추천자: ${recommenderName}

단계가 변경되었습니다! 🎉`

      await sendTelegramMessage({
        chatId: recommender.telegram_chat_id,
        text: telegramMessage,
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [[
            { text: '🌐 파이프라인 보기', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://jobizic-biz.vercel.app'}/pipeline` }
          ]]
        }
      })
      console.log('[Pipeline PATCH] Telegram sent to recommender:', oldPipeline.created_by)
    } catch (err) {
      console.error('[Pipeline PATCH] Telegram send failed:', err)
    }
  }
}
```

### 디바 분석 결과

**로직 자체는 정상**:
- ✅ `oldPipeline.created_by` (추천자) 확인
- ✅ `profile` (변경한 사람) 확인
- ✅ 본인이 변경한 것 제외: `oldPipeline.created_by !== updated_by`
- ✅ 추천자의 `telegram_chat_id` 조회
- ✅ 메시지 전송

**잠재적 문제점**:

1. **조건문 위치** ⚠️
   - 코드가 `if (stage && updated_by)` 블록 안에 있음 (44번 라인)
   - 그리고 다시 `if (oldPipeline && stage && stage !== oldPipeline.stage)` 안에 있음 (62번 라인)
   - **Frontend에서 `updated_by`를 전달하지 않으면 실행 안 됨!**

2. **함수 위치** ⚠️
   - `getStageEmoji` 함수가 조건문 안에 정의됨
   - 함수 스코프 문제 가능성

---

## 🎨 디아의 Frontend 검토

### Pipeline 페이지 단계 변경 함수

```typescript
async function updateStage(id: string, stage: string) {
  await fetch(`/api/pipeline/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage })  // ❌ updated_by 없음!
  })
  setPipeline(prev => prev.map(p => p.id === id ? { ...p, stage } : p))
  if (selected?.id === id) setSelected(prev => prev ? { ...prev, stage } : prev)
}
```

### 디아 발견 - 🔴 Critical Bug!

**Frontend에서 `updated_by`를 전달하지 않음!**

```json
// 현재
{ "stage": "1차면접" }

// 필요한 것
{ "stage": "1차면접", "updated_by": "user@example.com" }
```

**결과**:
- Backend의 `if (stage && updated_by)` 조건 실패
- 텔레그램 알림 코드 실행 안 됨!

---

## 🧪 테스의 검증 시나리오

### 재현 단계
1. JD Owner 계정 로그인
2. 채용 프로세스 페이지 접속
3. 후보자 카드 클릭 → 단계 변경 (예: 신규 → 1차면접)
4. **추천자 텔레그램 확인**

### 예상 결과
- ❌ 텔레그램 알림 전송 안 됨
- ❌ Vercel 로그에 `[Pipeline PATCH] Telegram sent to recommender:` 없음

### 예상 원인
- Frontend에서 `updated_by` 파라미터 누락

---

## ✅ 디바의 긴급 수정

### 수정 1: Frontend - updated_by 추가

```typescript
// app/pipeline/page.tsx
async function updateStage(id: string, stage: string) {
  const profile = await getProfile()
  if (!profile) return

  await fetch(`/api/pipeline/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      stage,
      updated_by: profile.email  // ✅ 추가!
    })
  })
  setPipeline(prev => prev.map(p => p.id === id ? { ...p, stage } : p))
  if (selected?.id === id) setSelected(prev => prev ? { ...prev, stage } : prev)
}
```

### 수정 2: Backend - 함수 위치 이동

```typescript
// getStageEmoji 함수를 PATCH 함수 밖으로 이동
// 또는 파일 최상단에 헬퍼 함수로 정의
```

### 수정 3: Backend - 디버그 로깅 추가

```typescript
console.log('[Pipeline PATCH] Stage change:', {
  oldStage: oldPipeline.stage,
  newStage: stage,
  updated_by,
  recommender: oldPipeline.created_by,
  hasProfile: !!profile
})
```

---

## 📊 테스트 체크리스트

### 수정 후 검증
- [ ] Frontend에서 `updated_by` 전달 확인 (Network 탭)
- [ ] Backend에서 `updated_by` 수신 확인 (Vercel 로그)
- [ ] 텔레그램 메시지 전송 확인
- [ ] Vercel 로그에 `[Pipeline PATCH] Telegram sent to recommender:` 확인

### 추가 확인 사항
- [ ] 본인이 변경한 경우 텔레그램 안 감 (정상)
- [ ] 텔레그램 미연동 추천자의 경우 에러 없이 스킵 (정상)
- [ ] JD Owner가 변경한 경우만 전송 (정상)

---

## 🚨 근본 원인

**Frontend에서 `updated_by` 파라미터를 전달하지 않음**

**영향**:
- Backend의 `if (stage && updated_by)` 조건 통과 못함
- 텔레그램 알림 코드 전체가 실행 안 됨
- 웹 알림도 전송 안 될 가능성

---

**작성**: 2026-06-07  
**보고**: 디바, 디아, 테스  
**상태**: 🔴 Critical Bug 발견 - 즉시 수정 필요  
**근본 원인**: Frontend에서 `updated_by` 누락

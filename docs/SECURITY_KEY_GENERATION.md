# 암호화 키 생성 보안 가이드

## 🔒 보안 레벨 비교

### 방법 1: 일반 모드 (현재 사용 중)

```bash
npm run generate:keys
```

| 항목 | 상태 | 설명 |
|------|------|------|
| 키 생성 알고리즘 | ✅ 안전 | Node.js crypto (CSPRNG) |
| Git 보안 | ✅ 안전 | .gitignore 포함 |
| 파일 저장 | ✅ 안전 | .env.local (600) |
| 화면 출력 | ⚠️ 주의 | 키가 터미널에 표시됨 |
| 터미널 히스토리 | ⚠️ 주의 | history에 남을 수 있음 |
| 화면 공유 위험 | ⚠️ 주의 | 스크린샷/녹화 시 노출 |

**권장 사용:**
- 개발 환경
- 1인 개발
- 화면 공유 안 할 때

---

### 방법 2: 보안 모드 (권장)

```bash
npm run generate:keys:secure
```

| 항목 | 상태 | 설명 |
|------|------|------|
| 키 생성 알고리즘 | ✅ 안전 | Node.js crypto (CSPRNG) |
| Git 보안 | ✅ 안전 | .gitignore 포함 |
| 파일 저장 | ✅ 안전 | .env.local (600) |
| 화면 출력 | ✅ 안전 | **키를 화면에 출력 안 함** |
| 터미널 히스토리 | ✅ 안전 | 키가 기록 안 됨 |
| 화면 공유 위험 | ✅ 안전 | 노출 위험 없음 |

**권장 사용:**
- 프로덕션 환경
- 팀 개발
- 화면 공유 할 때
- 보안이 중요한 프로젝트

---

### 방법 3: Vercel CLI (최고 보안)

```bash
npm run generate:keys:secure
bash scripts/upload-keys-to-vercel.sh
```

| 항목 | 상태 | 설명 |
|------|------|------|
| 키 생성 알고리즘 | ✅ 안전 | Node.js crypto (CSPRNG) |
| Git 보안 | ✅ 안전 | .gitignore 포함 |
| 파일 저장 | ✅ 안전 | .env.local (600) |
| 화면 출력 | ✅ 안전 | 키를 화면에 출력 안 함 |
| 터미널 히스토리 | ✅ 안전 | 키가 기록 안 됨 |
| 화면 공유 위험 | ✅ 안전 | 노출 위험 없음 |
| 수동 복사 불필요 | ✅ 안전 | **자동 업로드** |

**권장 사용:**
- 프로덕션 환경 (필수)
- 다수의 환경 변수
- CI/CD 통합

---

## 🎯 권장 사항

### 개발 환경
```bash
npm run generate:keys:secure
```

### 프로덕션 환경
```bash
# 1. 보안 모드로 생성
npm run generate:keys:secure

# 2. Vercel CLI로 자동 업로드 (선택)
bash scripts/upload-keys-to-vercel.sh

# 또는 수동 업로드
cat .env.local
# → Vercel Dashboard에 붙여넣기
```

---

## ⚠️ 절대 하지 말아야 할 것

### ❌ DON'T

1. **화면 공유 중 키 생성**
   ```bash
   ❌ Zoom/Teams 화면 공유 중
   ❌ 스크린 녹화 중
   ❌ 라이브 코딩 중
   ```

2. **키를 Slack/이메일로 전송**
   ```bash
   ❌ Slack DM
   ❌ 이메일
   ❌ 메신저
   ```

3. **키를 코드에 하드코딩**
   ```typescript
   ❌ const KEY = 'orVu2271...'  // 절대 안 됨!
   ```

4. **키를 Git에 커밋**
   ```bash
   ❌ git add .env.local  // 절대 안 됨!
   ```

5. **온라인 키 생성기 사용**
   ```bash
   ❌ random.org
   ❌ 온라인 Base64 인코더
   ```

### ✅ DO

1. **로컬에서 생성**
   ```bash
   ✅ npm run generate:keys:secure
   ```

2. **Password Manager에 백업**
   ```bash
   ✅ 1Password
   ✅ Bitwarden
   ✅ LastPass
   ```

3. **환경 변수로 관리**
   ```bash
   ✅ Vercel Dashboard
   ✅ Vercel CLI
   ✅ .env.local (로컬만)
   ```

4. **파일 권한 확인**
   ```bash
   ✅ chmod 600 .env.local
   ```

---

## 🔐 추가 보안 조치

### 1. 터미널 히스토리 클리어

```bash
# Bash
history -c
history -w

# Zsh
history -c
```

### 2. 파일 권한 확인

```bash
# Unix/Linux/Mac
ls -la .env.local
# -rw------- (600): OK ✅
# -rw-r--r-- (644): 위험! ❌

# 권한 수정
chmod 600 .env.local
```

### 3. Git 확인

```bash
# .env.local이 Git에 추가되지 않았는지 확인
git status

# Untracked files에 .env.local이 보이면 안 됨!
```

### 4. 정기적인 키 교체

```bash
# 6개월마다 키 교체 권장
# 주의: 기존 데이터 마이그레이션 필요!
npm run generate:keys:secure
```

---

## 📚 참고 자료

- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [NIST SP 800-57](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)

# Google Custom Search API 설정 가이드

Searching(Linkedin) 기능을 사용하려면 Google Custom Search API가 필요합니다.

## 1. Google Cloud Console 설정

### 1.1 프로젝트 생성
1. https://console.cloud.google.com 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택

### 1.2 Custom Search API 활성화
1. API 및 서비스 > 라이브러리로 이동
2. "Custom Search API" 검색
3. "사용" 버튼 클릭

### 1.3 API 키 생성
1. API 및 서비스 > 사용자 인증 정보로 이동
2. "사용자 인증 정보 만들기" > "API 키" 선택
3. 생성된 API 키 복사
4. `.env.local`에 `GOOGLE_SEARCH_API_KEY` 추가

```bash
GOOGLE_SEARCH_API_KEY=AIzaSy...
```

## 2. Custom Search Engine 생성

### 2.1 Programmable Search Engine 설정
1. https://programmablesearchengine.google.com 접속
2. "추가" 또는 "Create" 버튼 클릭
3. 검색 엔진 이름: "LinkedIn Profile Search"
4. 검색할 사이트:
   - `linkedin.com/in/*` 입력
   - "특정 사이트 또는 페이지 검색" 선택
5. 만들기 버튼 클릭

### 2.2 검색 엔진 ID 복사
1. 생성된 검색 엔진 클릭
2. "검색 엔진 ID" 또는 "Search engine ID" 복사
3. `.env.local`에 `GOOGLE_SEARCH_ENGINE_ID` 추가

```bash
GOOGLE_SEARCH_ENGINE_ID=a1b2c3d4e5f6g7h8i
```

### 2.3 고급 설정 (선택사항)
1. 제어판 > 설정 > 기본 탭
2. "전체 웹 검색" 켜기 (추천)
3. "이미지 검색" 켜기 (선택사항)

## 3. 환경변수 설정

`.env.local` 파일에 다음 환경변수를 추가:

```bash
# Google Custom Search API (for LinkedIn searching)
GOOGLE_SEARCH_API_KEY=AIzaSy...
GOOGLE_SEARCH_ENGINE_ID=a1b2c3d4e5f6g7h8i
```

## 4. 비용 및 할당량

### 무료 할당량
- **100 쿼리/일** 무료
- 초과 시: **$5 / 1,000 쿼리**

### 비용 절감 팁
1. 사용자당 검색 횟수 제한 (예: 10회/일)
2. 캐싱 활용
3. 검색 결과 로컬 저장

### 할당량 모니터링
1. Google Cloud Console > API 및 서비스 > 대시보드
2. Custom Search API 클릭
3. 할당량 탭에서 사용량 확인

## 5. 테스트

API 설정이 완료되면 다음 명령어로 테스트:

```bash
curl "https://www.googleapis.com/customsearch/v1?key=YOUR_API_KEY&cx=YOUR_SEARCH_ENGINE_ID&q=site:linkedin.com/in+software+engineer+Korea"
```

정상 응답이 오면 설정 완료!

## 6. 문제 해결

### API 키 오류
- API가 활성화되었는지 확인
- API 키가 올바른지 확인
- 결제 계정이 연결되었는지 확인 (필수)

### 검색 결과 없음
- Search Engine ID가 올바른지 확인
- "전체 웹 검색"이 켜져있는지 확인
- 검색 쿼리가 올바른지 확인

### 할당량 초과
- 무료 할당량(100회/일) 확인
- 필요시 결제 카드 등록 및 할당량 증가

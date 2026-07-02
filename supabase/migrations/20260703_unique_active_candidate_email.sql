-- 같은 이메일의 active 후보자는 1명만 존재하도록 UNIQUE 제약 추가
-- 이미 중복이 있다면 먼저 정리 필요

-- 1. 기존 중복 데이터 확인 (실행만, 실제 변경 안함)
-- SELECT email, COUNT(*) as count
-- FROM candidates
-- WHERE status = 'active' AND email IS NOT NULL
-- GROUP BY email
-- HAVING COUNT(*) > 1;

-- 2. UNIQUE partial index 생성 (active 상태인 것만)
-- PostgreSQL은 partial unique index를 지원합니다
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_email_active_unique
ON candidates (LOWER(TRIM(email)))
WHERE status = 'active' AND email IS NOT NULL AND email != '';

-- 이제 같은 이메일(대소문자/공백 무시)로 active 후보자를 중복 생성하면 에러 발생!

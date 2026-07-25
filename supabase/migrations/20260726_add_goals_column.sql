-- ====================================================================
-- profiles 테이블에 goals 컬럼 추가
-- 작성일: 2026-07-26
-- 작성자: 미르팀
-- ====================================================================
--
-- 목적: 사용자별 목표 설정 저장 (정산 전환액, 미수금 등)
--
-- goals 구조 예시:
-- {
--   "hiredTarget": 10,
--   "passedTarget": 20,
--   "proposalTarget": 10,
--   "settlements": {
--     "2025": {
--       "goalAmount": 5000,
--       "carryover": 0
--     },
--     "2026": {
--       "goalAmount": 8000,
--       "carryover": 1200
--     }
--   }
-- }
-- ====================================================================

-- 1. goals 컬럼 추가
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS goals JSONB DEFAULT '{}'::jsonb;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN profiles.goals IS '사용자별 목표 설정 (정산 전환액/미수금, 대시보드 목표 등)';

-- 3. GIN 인덱스 생성 (JSONB 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_profiles_goals ON profiles USING GIN (goals);

-- 4. 확인 쿼리 (주석)
-- SELECT email, goals FROM profiles WHERE goals IS NOT NULL LIMIT 5;

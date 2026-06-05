-- 고객사용 Role 3개 추가
-- Supabase SQL Editor에서 실행

-- 1. role enum에 새로운 값 추가
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client_owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client_pm';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client_searcher';

-- 2. 확인
SELECT enum_range(NULL::user_role);

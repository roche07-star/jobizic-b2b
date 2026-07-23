-- profiles 테이블에 user_type 컬럼 추가
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS user_type TEXT
CHECK (user_type IN ('SUPER_ADMIN', 'MANAGER', 'HEADHUNTER', 'JOBSEEKER'));

-- 기본값 설정 (기존 사용자는 role 기반으로)
UPDATE profiles
SET user_type = CASE
  WHEN role = 'admin' THEN 'MANAGER'
  WHEN role = 'owner' THEN 'MANAGER'
  WHEN role = 'headhunter' THEN 'HEADHUNTER'
  ELSE 'JOBSEEKER'
END
WHERE user_type IS NULL;

-- Super Admin 계정 설정 (jobizic.biz@gmail.com)
UPDATE profiles
SET user_type = 'SUPER_ADMIN'
WHERE email = 'jobizic.biz@gmail.com';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);

COMMENT ON COLUMN profiles.user_type IS 'SUPER_ADMIN: 무제한, MANAGER: 관리자, HEADHUNTER: 헤드헌터, JOBSEEKER: 구직자';

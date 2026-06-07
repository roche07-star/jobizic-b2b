-- Telegram Integration
-- Add telegram fields to profiles table and create link codes table

-- 1. profiles 테이블에 텔레그램 컬럼 추가
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_verified_at TIMESTAMPTZ;

-- 2. 임시 연동 코드 테이블 생성
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  user_email TEXT NOT NULL REFERENCES profiles(email) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_telegram_codes_expires ON telegram_link_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_telegram_codes_code ON telegram_link_codes(code) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat ON profiles(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

-- 4. 만료된 코드 자동 삭제 함수 (선택)
CREATE OR REPLACE FUNCTION delete_expired_telegram_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM telegram_link_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 텔레그램 연동 테이블이 생성되었습니다.';
  RAISE NOTICE '   - profiles 테이블에 telegram_chat_id, telegram_username, telegram_verified_at 추가';
  RAISE NOTICE '   - telegram_link_codes 테이블 생성 (연동 코드 관리)';
END $$;

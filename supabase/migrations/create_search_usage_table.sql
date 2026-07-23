-- 후보찾기 사용 횟수 추적 테이블
CREATE TABLE IF NOT EXISTS search_usage (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_search_usage_user_id ON search_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_search_usage_date ON search_usage(date);

-- 자동 cleanup (30일 이상 된 데이터 삭제)
CREATE OR REPLACE FUNCTION cleanup_old_search_usage()
RETURNS void AS $$
BEGIN
  DELETE FROM search_usage WHERE date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 매일 자동 cleanup (pg_cron 사용 시)
-- SELECT cron.schedule('cleanup-search-usage', '0 0 * * *', 'SELECT cleanup_old_search_usage()');

COMMENT ON TABLE search_usage IS '후보찾기 일일 사용 횟수 추적 (하루 3회 제한)';
COMMENT ON COLUMN search_usage.user_id IS '사용자 ID';
COMMENT ON COLUMN search_usage.date IS '사용 날짜';
COMMENT ON COLUMN search_usage.count IS '사용 횟수';

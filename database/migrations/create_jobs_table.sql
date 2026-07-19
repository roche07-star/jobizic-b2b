-- ============================================
-- Jobs 테이블 생성 (Eve B2B)
-- 용도: 백그라운드 작업 관리 (후보자 파싱, JD 분석 등)
-- ============================================

-- 1. jobs 테이블 생성
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  job_type TEXT NOT NULL, -- 'candidate_parse', 'jd_analyze', etc.
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'

  -- 입력 데이터
  input JSONB NOT NULL,

  -- 결과 데이터
  result JSONB,
  error TEXT,

  -- 진행 상황
  message TEXT,
  progress INTEGER DEFAULT 0, -- 0-100

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS jobs_user_email_idx ON jobs(user_email);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_user_status_idx ON jobs(user_email, status);

-- 3. RLS (Row Level Security) 설정
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Service role은 모든 작업 가능 (서버 사이드 API에서 사용)
CREATE POLICY "Service role full access" ON jobs
  FOR ALL USING (true);

-- 4. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 실행 후 확인:
-- SELECT * FROM jobs ORDER BY created_at DESC LIMIT 10;
-- ============================================

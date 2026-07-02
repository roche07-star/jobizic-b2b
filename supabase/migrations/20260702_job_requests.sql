-- 구직자 관리 테이블 (Adam에서 전송된 구직 요청)
CREATE TABLE IF NOT EXISTS job_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 구직자 정보
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  -- 구직 요청 정보
  position TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Adam 연동 정보
  adam_user_email TEXT NOT NULL,
  adam_application_id UUID,
  adam_analysis_id UUID,
  adam_analysis_data JSONB,

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending', -- pending, saved, rejected

  -- 후보자 저장 정보
  candidate_id UUID REFERENCES candidates(id),
  saved_by TEXT,
  saved_at TIMESTAMPTZ,

  -- 메타데이터
  source TEXT DEFAULT 'adam',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_job_requests_status ON job_requests(status);
CREATE INDEX idx_job_requests_email ON job_requests(email);
CREATE INDEX idx_job_requests_created_at ON job_requests(created_at DESC);

-- RLS 비활성화 (관리자만 접근)
ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;

-- 코멘트
COMMENT ON TABLE job_requests IS 'Adam에서 전송된 구직 요청 목록 (관리자 검토용)';

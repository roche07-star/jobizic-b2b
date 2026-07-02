-- 구직자 헤드헌터 요청 테이블
CREATE TABLE IF NOT EXISTS job_seeker_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 구직자 정보 (Adam에서 전달)
  adam_user_email text NOT NULL,
  adam_user_name text,
  adam_application_id text NOT NULL,

  -- 지원 정보
  company text NOT NULL,
  position text NOT NULL,
  status text,
  request_message text,

  -- 헤드헌터 할당
  assigned_headhunter_id uuid,
  assigned_at timestamptz,

  -- 상태 관리
  request_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_job_seeker_requests_status ON job_seeker_requests(request_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_seeker_requests_email ON job_seeker_requests(adam_user_email);

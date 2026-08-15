-- 접근 로그 테이블
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL, -- 'candidate_access', 'jd_access', etc
  actor_email TEXT NOT NULL, -- 행위자 (헤드헌터) 이메일
  target_email TEXT, -- 대상 (후보자) 이메일
  target_id TEXT, -- 대상 ID (candidate_id, jd_id 등)
  details JSONB, -- 추가 상세 정보
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email ON audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_email ON audit_logs(target_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON audit_logs(target_id);

-- RLS (Row Level Security) 설정
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 충돌 방지)
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON audit_logs;

-- 관리자만 조회 가능
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.email = (SELECT auth.jwt()->>'email')
      AND profiles.role = 'admin'
    )
  );

-- 모든 사용자가 로그 기록 가능 (브라우저에서 직접 INSERT)
CREATE POLICY "Anyone can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE audit_logs IS '헤드헌터 후보자 접근 로그 (개인정보보호법 제26조 준수)';
COMMENT ON COLUMN audit_logs.action IS '액션 타입 (candidate_access, jd_access 등)';
COMMENT ON COLUMN audit_logs.actor_email IS '행위자 (헤드헌터) 이메일';
COMMENT ON COLUMN audit_logs.target_email IS '대상 (후보자) 이메일';
COMMENT ON COLUMN audit_logs.target_id IS '대상 ID (candidate_id 등)';
COMMENT ON COLUMN audit_logs.details IS '추가 정보 (액션 타입, 페이지 등)';

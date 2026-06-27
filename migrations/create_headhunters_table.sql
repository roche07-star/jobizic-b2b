-- ============================================================
-- 헤드헌터 관리(Headhunters) 테이블 - eve (B2B)
-- ============================================================

-- 1. headhunters 테이블 생성
CREATE TABLE IF NOT EXISTS headhunters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  -- 역할 (여러 역할 가능)
  can_pm BOOLEAN DEFAULT true,
  can_search BOOLEAN DEFAULT true,

  -- 상태
  is_active BOOLEAN DEFAULT true,

  -- 관계
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 제약 조건
  CONSTRAINT unique_headhunter_email_per_org UNIQUE (email, organization_id)
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_headhunters_organization ON headhunters(organization_id);
CREATE INDEX IF NOT EXISTS idx_headhunters_email ON headhunters(email);
CREATE INDEX IF NOT EXISTS idx_headhunters_user ON headhunters(user_id);
CREATE INDEX IF NOT EXISTS idx_headhunters_active ON headhunters(is_active);

-- 3. RLS
ALTER TABLE headhunters ENABLE ROW LEVEL SECURITY;

-- Owner는 자신의 organization의 헤드헌터 관리 가능
CREATE POLICY "Owner는 organization 헤드헌터 조회 가능"
ON headhunters FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users
    WHERE email = auth.jwt() ->> 'email'
    AND role = 'OWNER'
  )
);

CREATE POLICY "Owner는 organization 헤드헌터 추가 가능"
ON headhunters FOR INSERT TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users
    WHERE email = auth.jwt() ->> 'email'
    AND role = 'OWNER'
  )
);

CREATE POLICY "Owner는 organization 헤드헌터 수정 가능"
ON headhunters FOR UPDATE TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users
    WHERE email = auth.jwt() ->> 'email'
    AND role = 'OWNER'
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users
    WHERE email = auth.jwt() ->> 'email'
    AND role = 'OWNER'
  )
);

CREATE POLICY "Owner는 organization 헤드헌터 삭제 가능"
ON headhunters FOR DELETE TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users
    WHERE email = auth.jwt() ->> 'email'
    AND role = 'OWNER'
  )
);

-- 헤드헌터는 자신의 정보만 조회 가능
CREATE POLICY "헤드헌터는 자신의 정보 조회 가능"
ON headhunters FOR SELECT TO authenticated
USING (
  email = auth.jwt() ->> 'email'
);

-- 4. 트리거
CREATE OR REPLACE FUNCTION update_headhunters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER headhunters_updated_at_trigger
BEFORE UPDATE ON headhunters
FOR EACH ROW
EXECUTE FUNCTION update_headhunters_updated_at();

-- 5. 코멘트
COMMENT ON TABLE headhunters IS '헤드헌터 관리 테이블';
COMMENT ON COLUMN headhunters.name IS '헤드헌터 이름';
COMMENT ON COLUMN headhunters.email IS '이메일';
COMMENT ON COLUMN headhunters.can_pm IS 'PM 역할 가능 여부';
COMMENT ON COLUMN headhunters.can_search IS '써처 역할 가능 여부';
COMMENT ON COLUMN headhunters.is_active IS '활성 상태';
COMMENT ON COLUMN headhunters.organization_id IS '소속 organization';
COMMENT ON COLUMN headhunters.user_id IS '연결된 user (있으면)';

-- ============================================================
-- 정산(Settlements) 테이블 - eve (B2B)
-- ============================================================

-- 1. ENUM 타입 생성
DO $$ BEGIN
  CREATE TYPE headhunter_role AS ENUM ('PM_SOLO', 'PM', 'SEARCHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. settlements 테이블 생성
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 후보자 정보
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  company TEXT,
  position TEXT,
  start_date DATE NOT NULL,

  -- 금액 정보
  salary BIGINT NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 17.00,
  incentive_rate NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  personal_override BIGINT DEFAULT 0,

  -- 역할/파트너 정보
  my_role headhunter_role DEFAULT 'PM',
  partner_name TEXT,
  my_ratio INTEGER DEFAULT 50,

  -- 메타 정보
  memo TEXT,
  year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM start_date)) STORED,

  -- 관계
  headhunter_email TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 제약 조건
  CONSTRAINT valid_salary CHECK (salary >= 0),
  CONSTRAINT valid_commission_rate CHECK (commission_rate >= 0 AND commission_rate <= 100),
  CONSTRAINT valid_incentive_rate CHECK (incentive_rate >= 0 AND incentive_rate <= 100),
  CONSTRAINT valid_my_ratio CHECK (my_ratio >= 0 AND my_ratio <= 100)
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_settlements_headhunter ON settlements(headhunter_email);
CREATE INDEX IF NOT EXISTS idx_settlements_organization ON settlements(organization_id);
CREATE INDEX IF NOT EXISTS idx_settlements_year ON settlements(year);
CREATE INDEX IF NOT EXISTS idx_settlements_org_year ON settlements(organization_id, year);
CREATE INDEX IF NOT EXISTS idx_settlements_my_role ON settlements(my_role);
CREATE INDEX IF NOT EXISTS idx_settlements_partner_name ON settlements(partner_name);

-- 4. RLS
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- 헤드헌터는 자신의 organization 내 자신의 정산만 조회
CREATE POLICY "헤드헌터는 자신의 정산만 조회 가능"
ON settlements FOR SELECT TO authenticated
USING (
  headhunter_email = auth.jwt() ->> 'email'
  AND organization_id IN (
    SELECT organization_id FROM users WHERE email = auth.jwt() ->> 'email'
  )
);

-- 헤드헌터는 자신의 organization 내에서만 정산 생성 가능
CREATE POLICY "헤드헌터는 자신의 정산만 생성 가능"
ON settlements FOR INSERT TO authenticated
WITH CHECK (
  headhunter_email = auth.jwt() ->> 'email'
  AND organization_id IN (
    SELECT organization_id FROM users WHERE email = auth.jwt() ->> 'email'
  )
);

-- 헤드헌터는 자신의 정산만 수정 가능
CREATE POLICY "헤드헌터는 자신의 정산만 수정 가능"
ON settlements FOR UPDATE TO authenticated
USING (
  headhunter_email = auth.jwt() ->> 'email'
  AND organization_id IN (
    SELECT organization_id FROM users WHERE email = auth.jwt() ->> 'email'
  )
)
WITH CHECK (
  headhunter_email = auth.jwt() ->> 'email'
  AND organization_id IN (
    SELECT organization_id FROM users WHERE email = auth.jwt() ->> 'email'
  )
);

-- 헤드헌터는 자신의 정산만 삭제 가능
CREATE POLICY "헤드헌터는 자신의 정산만 삭제 가능"
ON settlements FOR DELETE TO authenticated
USING (
  headhunter_email = auth.jwt() ->> 'email'
  AND organization_id IN (
    SELECT organization_id FROM users WHERE email = auth.jwt() ->> 'email'
  )
);

-- Owner는 자신의 organization의 모든 정산 조회 가능
CREATE POLICY "Owner는 organization 전체 정산 조회 가능"
ON settlements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.email = auth.jwt() ->> 'email'
    AND users.organization_id = settlements.organization_id
    AND users.role = 'OWNER'
  )
);

-- 5. 트리거
CREATE OR REPLACE FUNCTION update_settlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settlements_updated_at_trigger
BEFORE UPDATE ON settlements
FOR EACH ROW
EXECUTE FUNCTION update_settlements_updated_at();

-- 6. 코멘트
COMMENT ON TABLE settlements IS '헤드헌터 정산 테이블';
COMMENT ON COLUMN settlements.candidate_name IS '합격자 이름';
COMMENT ON COLUMN settlements.start_date IS '입사일';
COMMENT ON COLUMN settlements.salary IS '연봉 (만원)';
COMMENT ON COLUMN settlements.commission_rate IS '수수료율 (%)';
COMMENT ON COLUMN settlements.incentive_rate IS '요율 (%)';
COMMENT ON COLUMN settlements.my_role IS '나의 역할 (PM_SOLO: PM 단독, PM: PM, SEARCHER: 써처)';
COMMENT ON COLUMN settlements.partner_name IS '파트너 이름 (함께 일한 PM 또는 써처)';
COMMENT ON COLUMN settlements.my_ratio IS '내 비율 (0-100%)';
COMMENT ON COLUMN settlements.year IS '연도 (start_date에서 자동 추출)';
COMMENT ON COLUMN settlements.headhunter_email IS '헤드헌터 이메일';
COMMENT ON COLUMN settlements.organization_id IS '소속 organization';

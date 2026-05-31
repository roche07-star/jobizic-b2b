-- 기존 테이블에 organization_id 추가 (Migration)
-- Supabase에서 SQL Editor로 실행하세요
-- 주의: 이미 데이터가 있다면 백업 후 실행하세요

-- 1. job_descriptions에 organization_id 추가
ALTER TABLE job_descriptions
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_jd_organization_id ON job_descriptions(organization_id);

-- 2. candidates에 organization_id 추가
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_candidates_organization_id ON candidates(organization_id);

-- 3. pipeline은 jd_id를 통해 간접적으로 organization 확인 가능하므로 추가 안 해도 됨
-- 하지만 성능을 위해 추가
ALTER TABLE pipeline
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pipeline_organization_id ON pipeline(organization_id);

-- 기존 RLS 정책 삭제 (organization 기반으로 재생성)
DROP POLICY IF EXISTS "Enable read access for all users" ON job_descriptions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON job_descriptions;
DROP POLICY IF EXISTS "Enable update access for all users" ON job_descriptions;
DROP POLICY IF EXISTS "Enable delete access for all users" ON job_descriptions;

DROP POLICY IF EXISTS "Enable read access for all users" ON candidates;
DROP POLICY IF EXISTS "Enable insert access for all users" ON candidates;
DROP POLICY IF EXISTS "Enable update access for all users" ON candidates;
DROP POLICY IF EXISTS "Enable delete access for all users" ON candidates;

DROP POLICY IF EXISTS "Enable read access for all users" ON pipeline;
DROP POLICY IF EXISTS "Enable insert access for all users" ON pipeline;
DROP POLICY IF EXISTS "Enable update access for all users" ON pipeline;
DROP POLICY IF EXISTS "Enable delete access for all users" ON pipeline;

-- 새로운 RLS 정책: organization 기반

-- ========================================
-- JOB_DESCRIPTIONS RLS 정책
-- ========================================

-- Admin: 모든 JD 조회 가능
CREATE POLICY "Admins can view all JDs" ON job_descriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Headhunter: 자신의 조직 JD만 조회
CREATE POLICY "Headhunters can view org JDs" ON job_descriptions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

-- Client: 자신에게 허용된 JD만 조회
CREATE POLICY "Clients can view allowed JDs" ON job_descriptions
  FOR SELECT
  USING (
    id = ANY(
      SELECT unnest(allowed_jd_ids) FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );

-- Headhunter: 자신의 조직 JD 추가 가능
CREATE POLICY "Headhunters can insert org JDs" ON job_descriptions
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

-- Headhunter: 자신의 조직 JD 수정 가능
CREATE POLICY "Headhunters can update org JDs" ON job_descriptions
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

-- Headhunter: 자신의 조직 JD 삭제 가능
CREATE POLICY "Headhunters can delete org JDs" ON job_descriptions
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

-- ========================================
-- CANDIDATES RLS 정책
-- ========================================

-- Admin: 모든 후보자 조회
CREATE POLICY "Admins can view all candidates" ON candidates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Headhunter: 자신의 조직 후보자만 조회
CREATE POLICY "Headhunters can view org candidates" ON candidates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

-- Client: 후보자 조회 불가 (보안)
-- (필요시 특정 pipeline을 통해서만 제한적으로 조회)

-- Headhunter: CRUD 권한
CREATE POLICY "Headhunters can insert org candidates" ON candidates
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

CREATE POLICY "Headhunters can update org candidates" ON candidates
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

CREATE POLICY "Headhunters can delete org candidates" ON candidates
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

-- ========================================
-- PIPELINE RLS 정책
-- ========================================

-- Admin: 모든 파이프라인 조회
CREATE POLICY "Admins can view all pipeline" ON pipeline
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Headhunter: 자신의 조직 파이프라인만 조회
CREATE POLICY "Headhunters can view org pipeline" ON pipeline
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

-- Client: 자신의 JD와 연결된 파이프라인만 조회
CREATE POLICY "Clients can view own JD pipeline" ON pipeline
  FOR SELECT
  USING (
    jd_id = ANY(
      SELECT unnest(allowed_jd_ids) FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );

-- Headhunter: CRUD 권한
CREATE POLICY "Headhunters can insert org pipeline" ON pipeline
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

CREATE POLICY "Headhunters can update org pipeline" ON pipeline
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

CREATE POLICY "Headhunters can delete org pipeline" ON pipeline
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

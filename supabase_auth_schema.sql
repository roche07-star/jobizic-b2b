-- Jobizic B2B (eve) - Multi-tenant Authentication & Authorization
-- Supabase에서 SQL Editor로 실행하세요

-- 1. Organizations (써치펌/조직) 테이블
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 조직 정보
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'headhunter', -- 'headhunter', 'enterprise'

  -- 연락처
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),

  -- 상태
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'suspended'

  -- 플랜 정보 (향후 확장)
  plan VARCHAR(50) DEFAULT 'basic', -- 'basic', 'pro', 'enterprise'

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Profiles (사용자 프로필) 테이블
-- Supabase Auth의 auth.users와 1:1 관계
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 조직 연결
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- 사용자 정보
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),

  -- 역할
  role VARCHAR(50) DEFAULT 'headhunter', -- 'admin', 'headhunter', 'client'

  -- 클라이언트 전용 (role='client'일 때만 사용)
  client_company_name VARCHAR(255), -- 고객사 이름
  allowed_jd_ids UUID[], -- 접근 가능한 JD ID 리스트

  -- 상태
  is_active BOOLEAN DEFAULT true,

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- RLS 활성화
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Organizations RLS 정책
-- Admin은 모든 조직 조회 가능
CREATE POLICY "Admins can view all organizations" ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 헤드헌터/클라이언트는 자신의 조직만 조회 가능
CREATE POLICY "Users can view own organization" ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Profiles RLS 정책
-- 사용자는 자신의 프로필 조회 가능
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- Admin은 모든 프로필 조회 가능
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- 같은 조직의 헤드헌터는 같은 조직 프로필 조회 가능
CREATE POLICY "Headhunters can view org profiles" ON profiles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'headhunter'
    )
  );

-- 프로필 업데이트는 본인만
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (id = auth.uid());

-- updated_at 트리거
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 새 사용자 가입 시 자동으로 profile 생성하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'headhunter')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users에 트리거 연결
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

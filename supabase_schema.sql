-- Jobizic B2B (eve) - Job Descriptions Table
-- Supabase에서 SQL Editor로 실행하세요

CREATE TABLE IF NOT EXISTS job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 원본 데이터
  raw_text TEXT NOT NULL,
  source VARCHAR(50) DEFAULT '수동', -- '수동', '이메일', '크롤링'

  -- 파싱된 기본 정보
  company VARCHAR(255),
  position VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  salary VARCHAR(100),
  deadline VARCHAR(100) DEFAULT 'ASAP',

  -- 스킬 및 키워드
  keywords TEXT[] DEFAULT '{}',
  required_skills TEXT[] DEFAULT '{}',
  preferred_skills TEXT[] DEFAULT '{}',

  -- 헤드헌터용 분석 정보
  priority VARCHAR(20) DEFAULT '일반', -- '긴급', '중요', '일반'
  difficulty VARCHAR(10) DEFAULT '중', -- '상', '중', '하'
  difficulty_reason TEXT,
  target_profile TEXT,
  search_strategy TEXT,
  salary_estimate VARCHAR(100),
  key_points TEXT[] DEFAULT '{}',

  -- 상태 관리
  status VARCHAR(50) DEFAULT '검토중', -- '검토중', '활성', '마감', '보류'

  -- 추가 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_jd_created_at ON job_descriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jd_status ON job_descriptions(status);
CREATE INDEX IF NOT EXISTS idx_jd_priority ON job_descriptions(priority);
CREATE INDEX IF NOT EXISTS idx_jd_company ON job_descriptions(company);
CREATE INDEX IF NOT EXISTS idx_jd_position ON job_descriptions(position);

-- RLS (Row Level Security) 활성화
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능 (개발 단계용, 나중에 수정 필요)
CREATE POLICY "Enable read access for all users" ON job_descriptions
  FOR SELECT USING (true);

-- 모든 사용자가 쓰기 가능 (개발 단계용, 나중에 수정 필요)
CREATE POLICY "Enable insert access for all users" ON job_descriptions
  FOR INSERT WITH CHECK (true);

-- 모든 사용자가 업데이트 가능 (개발 단계용, 나중에 수정 필요)
CREATE POLICY "Enable update access for all users" ON job_descriptions
  FOR UPDATE USING (true);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_job_descriptions_updated_at
  BEFORE UPDATE ON job_descriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

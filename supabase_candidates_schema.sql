-- Jobizic B2B (eve) - Candidates Table
-- Supabase에서 SQL Editor로 실행하세요

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 기본 정보
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  location VARCHAR(255),

  -- 원본 이력서
  raw_resume TEXT NOT NULL,
  source VARCHAR(50) DEFAULT '수동', -- '수동', '이메일', '크롤링', '추천'

  -- 파싱된 경력 정보
  current_company VARCHAR(255),
  current_position VARCHAR(255),
  total_experience_years INTEGER, -- 총 경력 년수
  career_summary TEXT, -- 경력 요약
  education TEXT[], -- 학력 (배열)

  -- 스킬 및 전문성
  skills TEXT[] DEFAULT '{}',
  tech_stack TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}', -- 언어 능력

  -- 희망 조건
  desired_position VARCHAR(255),
  desired_salary VARCHAR(100),
  desired_location VARCHAR(255),
  job_search_status VARCHAR(50) DEFAULT '적극적', -- '적극적', '관심있음', '잠재적'

  -- AI 분석 정보
  strength_summary TEXT, -- 강점 요약
  career_trajectory TEXT, -- 커리어 방향성
  ideal_roles TEXT[], -- 적합한 포지션들
  market_value VARCHAR(100), -- 시장 가치 평가
  key_highlights TEXT[], -- 주요 하이라이트

  -- 헤드헌터 메모
  headhunter_notes TEXT,
  tags TEXT[] DEFAULT '{}', -- 태그 (예: 'AI전문가', '스타트업경험', '리더십')

  -- 상태 관리
  status VARCHAR(50) DEFAULT '검토중', -- '검토중', '활성', '제안중', '합격', '보류', '아카이브'

  -- 연락 이력
  last_contacted_at TIMESTAMPTZ,
  contact_count INTEGER DEFAULT 0,

  -- 추가 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(name);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_current_company ON candidates(current_company);
CREATE INDEX IF NOT EXISTS idx_candidates_skills ON candidates USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_candidates_tags ON candidates USING GIN(tags);

-- RLS (Row Level Security) 활성화
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능 (개발 단계용)
CREATE POLICY "Enable read access for all users" ON candidates
  FOR SELECT USING (true);

-- 모든 사용자가 쓰기 가능 (개발 단계용)
CREATE POLICY "Enable insert access for all users" ON candidates
  FOR INSERT WITH CHECK (true);

-- 모든 사용자가 업데이트 가능 (개발 단계용)
CREATE POLICY "Enable update access for all users" ON candidates
  FOR UPDATE USING (true);

-- 모든 사용자가 삭제 가능 (개발 단계용)
CREATE POLICY "Enable delete access for all users" ON candidates
  FOR DELETE USING (true);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

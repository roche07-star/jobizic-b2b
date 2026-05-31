-- Jobizic B2B (eve) - Pipeline Table
-- JD와 후보자를 연결하는 채용 진행 상황 관리
-- Supabase에서 SQL Editor로 실행하세요

CREATE TABLE IF NOT EXISTS pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 관계 (JD - 후보자)
  jd_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,

  -- 진행 단계
  stage VARCHAR(50) DEFAULT '신규', -- '신규', '서류검토', '1차면접', '2차면접', '최종면접', '처우협의', '합격', '불합격', '포기'

  -- AI 매칭 정보
  match_score INTEGER, -- 0-100 매칭 점수
  match_reason TEXT, -- 매칭 근거
  skill_match_rate INTEGER, -- 스킬 매칭률 (0-100)
  experience_match TEXT, -- 경력 적합도 평가
  strength_for_jd TEXT[], -- 이 JD에 대한 후보자 강점
  concerns TEXT[], -- 우려사항

  -- 헤드헌터 활동
  headhunter_notes TEXT, -- 헤드헌터 메모
  contacted_at TIMESTAMPTZ, -- 최초 컨택 일시
  last_activity_at TIMESTAMPTZ, -- 마지막 활동 일시
  next_action VARCHAR(255), -- 다음 액션 (예: "2차 면접 일정 조율")
  next_action_date DATE, -- 다음 액션 예정일

  -- 진행 상태
  is_active BOOLEAN DEFAULT true,
  priority VARCHAR(20) DEFAULT '보통', -- '긴급', '높음', '보통', '낮음'

  -- 면접/스코어카드 정보
  interview_feedback JSONB DEFAULT '[]'::jsonb, -- [{stage: '1차면접', date: '2024-01-01', feedback: '...', score: 85}]

  -- 처우 정보
  proposed_salary VARCHAR(100), -- 제안 연봉
  final_salary VARCHAR(100), -- 최종 합의 연봉

  -- 결과
  result VARCHAR(50), -- '진행중', '합격', '불합격', '후보자포기', '클라이언트보류'
  result_reason TEXT, -- 결과 사유
  closed_at TIMESTAMPTZ, -- 종료 일시

  -- 추가 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 중복 방지 (같은 JD에 같은 후보자는 한 번만)
  UNIQUE(jd_id, candidate_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_pipeline_created_at ON pipeline(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_jd_id ON pipeline(jd_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_candidate_id ON pipeline(candidate_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_is_active ON pipeline(is_active);
CREATE INDEX IF NOT EXISTS idx_pipeline_priority ON pipeline(priority);
CREATE INDEX IF NOT EXISTS idx_pipeline_next_action_date ON pipeline(next_action_date);

-- RLS (Row Level Security) 활성화
ALTER TABLE pipeline ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능 (개발 단계용)
CREATE POLICY "Enable read access for all users" ON pipeline
  FOR SELECT USING (true);

-- 모든 사용자가 쓰기 가능 (개발 단계용)
CREATE POLICY "Enable insert access for all users" ON pipeline
  FOR INSERT WITH CHECK (true);

-- 모든 사용자가 업데이트 가능 (개발 단계용)
CREATE POLICY "Enable update access for all users" ON pipeline
  FOR UPDATE USING (true);

-- 모든 사용자가 삭제 가능 (개발 단계용)
CREATE POLICY "Enable delete access for all users" ON pipeline
  FOR DELETE USING (true);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_pipeline_updated_at
  BEFORE UPDATE ON pipeline
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

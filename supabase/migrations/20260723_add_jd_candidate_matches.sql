-- =====================================================
-- JD-후보자 매칭 분석 결과 저장 테이블
-- 작성일: 2026-07-23
-- 담당: 디바 (미르팀)
-- =====================================================

CREATE TABLE IF NOT EXISTS jd_candidate_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jd_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,

  -- 매칭 분석 결과
  match_score INTEGER NOT NULL,
  match_reason TEXT,
  skill_match_rate INTEGER,
  experience_match TEXT,
  strength_for_jd TEXT[], -- 강점 목록
  concerns TEXT[], -- 우려사항 목록
  recommendation TEXT NOT NULL, -- '추천' | '보류' | '부적합'
  next_steps TEXT,

  -- 메타데이터
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 중복 방지: JD + 후보자 조합은 유일
  UNIQUE(jd_id, candidate_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_jd_matches_jd ON jd_candidate_matches(jd_id);
CREATE INDEX IF NOT EXISTS idx_jd_matches_candidate ON jd_candidate_matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_jd_matches_org ON jd_candidate_matches(organization_id);
CREATE INDEX IF NOT EXISTS idx_jd_matches_created_by ON jd_candidate_matches(created_by);

-- RLS 활성화
ALTER TABLE jd_candidate_matches ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 조직 내 멤버만 조회 가능
CREATE POLICY "Organization members can view matches"
  ON jd_candidate_matches
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE email = current_user
    )
  );

-- RLS 정책: 조직 내 멤버만 생성 가능
CREATE POLICY "Organization members can create matches"
  ON jd_candidate_matches
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE email = current_user
    )
  );

-- RLS 정책: 조직 내 멤버만 수정 가능
CREATE POLICY "Organization members can update matches"
  ON jd_candidate_matches
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE email = current_user
    )
  );

-- RLS 정책: 조직 내 멤버만 삭제 가능
CREATE POLICY "Organization members can delete matches"
  ON jd_candidate_matches
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE email = current_user
    )
  );

-- 코멘트
COMMENT ON TABLE jd_candidate_matches IS 'JD-후보자 매칭 분석 결과 저장 (페이지 새로고침 시에도 유지)';
COMMENT ON COLUMN jd_candidate_matches.match_score IS '매칭 점수 (0-100)';
COMMENT ON COLUMN jd_candidate_matches.skill_match_rate IS '스킬 매칭률 (0-100)';
COMMENT ON COLUMN jd_candidate_matches.recommendation IS '최종 추천: 추천 | 보류 | 부적합';

DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'JD-후보자 매칭 분석 테이블 생성 완료!';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '테이블: jd_candidate_matches';
  RAISE NOTICE '인덱스: 4개';
  RAISE NOTICE 'RLS 정책: 4개 (조직별 격리)';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '이제 매칭 분석 결과가 DB에 저장되어';
  RAISE NOTICE '페이지 새로고침 시에도 유지됩니다.';
  RAISE NOTICE '=================================================';
END $$;

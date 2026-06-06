-- JD 관심 등록 테이블 생성
CREATE TABLE IF NOT EXISTS jd_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jd_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, jd_id)
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_jd_interests_user_id ON jd_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_jd_interests_jd_id ON jd_interests(jd_id);

-- RLS 활성화
ALTER TABLE jd_interests ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 관심 등록만 조회/삽입/삭제 가능
CREATE POLICY "Users can view their own interests"
  ON jd_interests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own interests"
  ON jd_interests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own interests"
  ON jd_interests FOR DELETE
  USING (auth.uid() = user_id);

-- 코멘트
COMMENT ON TABLE jd_interests IS 'JD 관심 등록 테이블 - PM/Searcher가 관심 있는 JD를 등록';
COMMENT ON COLUMN jd_interests.user_id IS '관심 등록한 사용자 ID';
COMMENT ON COLUMN jd_interests.jd_id IS '관심 등록된 JD ID';

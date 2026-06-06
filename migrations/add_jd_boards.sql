-- JD 게시판 테이블 생성
CREATE TABLE IF NOT EXISTS jd_boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jd_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_email TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_jd_boards_jd_id ON jd_boards(jd_id);
CREATE INDEX IF NOT EXISTS idx_jd_boards_created_at ON jd_boards(created_at DESC);

-- RLS 활성화
ALTER TABLE jd_boards ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 게시판 조회
-- JD 소유주, 조직 Owner, 관심 등록자만 조회 가능
DROP POLICY IF EXISTS "Users can view jd board posts" ON jd_boards;
CREATE POLICY "Users can view jd board posts"
  ON jd_boards FOR SELECT
  USING (
    -- JD 소유주
    EXISTS (
      SELECT 1 FROM job_descriptions jd
      WHERE jd.id = jd_boards.jd_id
      AND jd.created_by = auth.jwt()->>'email'
    )
    OR
    -- 조직 Owner
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.email = auth.jwt()->>'email'
      AND p.role = 'Owner'
    )
    OR
    -- 관심 등록자
    EXISTS (
      SELECT 1 FROM jd_interests ji
      WHERE ji.jd_id = jd_boards.jd_id
      AND ji.user_id = auth.uid()
    )
  );

-- RLS 정책: 게시글 작성
-- JD 소유주, 조직 Owner, 관심 등록자만 작성 가능
DROP POLICY IF EXISTS "Users can create jd board posts" ON jd_boards;
CREATE POLICY "Users can create jd board posts"
  ON jd_boards FOR INSERT
  WITH CHECK (
    -- 본인이 작성자
    author_email = auth.jwt()->>'email'
    AND
    (
      -- JD 소유주
      EXISTS (
        SELECT 1 FROM job_descriptions jd
        WHERE jd.id = jd_boards.jd_id
        AND jd.created_by = auth.jwt()->>'email'
      )
      OR
      -- 조직 Owner
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.email = auth.jwt()->>'email'
        AND p.role = 'Owner'
      )
      OR
      -- 관심 등록자
      EXISTS (
        SELECT 1 FROM jd_interests ji
        WHERE ji.jd_id = jd_boards.jd_id
        AND ji.user_id = auth.uid()
      )
    )
  );

-- RLS 정책: 게시글 수정
-- 본인 글만 수정 가능
DROP POLICY IF EXISTS "Users can update their own posts" ON jd_boards;
CREATE POLICY "Users can update their own posts"
  ON jd_boards FOR UPDATE
  USING (author_email = auth.jwt()->>'email')
  WITH CHECK (author_email = auth.jwt()->>'email');

-- RLS 정책: 게시글 삭제
-- 본인 글, JD 소유주, 조직 Owner만 삭제 가능
DROP POLICY IF EXISTS "Users can delete jd board posts" ON jd_boards;
CREATE POLICY "Users can delete jd board posts"
  ON jd_boards FOR DELETE
  USING (
    -- 본인 글
    author_email = auth.jwt()->>'email'
    OR
    -- JD 소유주
    EXISTS (
      SELECT 1 FROM job_descriptions jd
      WHERE jd.id = jd_boards.jd_id
      AND jd.created_by = auth.jwt()->>'email'
    )
    OR
    -- 조직 Owner
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.email = auth.jwt()->>'email'
      AND p.role = 'Owner'
    )
  );

-- 코멘트
COMMENT ON TABLE jd_boards IS 'JD별 진행 상황 공유 게시판';
COMMENT ON COLUMN jd_boards.jd_id IS '연관된 JD ID';
COMMENT ON COLUMN jd_boards.author_id IS '작성자 user ID';
COMMENT ON COLUMN jd_boards.author_email IS '작성자 이메일';
COMMENT ON COLUMN jd_boards.title IS '게시글 제목';
COMMENT ON COLUMN jd_boards.content IS '게시글 내용';

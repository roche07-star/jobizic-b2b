-- ============================================
-- Company Boards (회사별 게시판)
-- ============================================
-- 각 조직별 독립적인 게시판
-- Super admin은 모든 조직 게시판 접근 가능
-- 다단계 댓글 지원
-- 이미지 첨부 지원
-- ============================================

-- 게시판 테이블
CREATE TABLE IF NOT EXISTS company_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 내용
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- 다단계 댓글 지원
  parent_id UUID REFERENCES company_boards(id) ON DELETE CASCADE,
  depth INTEGER DEFAULT 0,

  -- 이미지 첨부
  image_urls TEXT[], -- Supabase Storage URLs

  -- 메타데이터
  is_admin_reply BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE, -- 공지사항 고정
  view_count INTEGER DEFAULT 0,

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- 인덱스
CREATE INDEX idx_company_boards_org ON company_boards(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_company_boards_parent ON company_boards(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_company_boards_created ON company_boards(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_company_boards_pinned ON company_boards(is_pinned, created_at DESC) WHERE deleted_at IS NULL;

-- RLS (Row Level Security) 활성화
ALTER TABLE company_boards ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS 정책
-- ============================================

-- 1. SELECT 정책: 자기 조직 또는 Admin
CREATE POLICY "Users can view their organization's boards"
  ON company_boards FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      -- 자기 조직
      organization_id IN (
        SELECT organization_id
        FROM profiles
        WHERE id = auth.uid()
      )
      OR
      -- Admin은 모든 조직 접근
      EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );

-- 2. INSERT 정책: 자기 조직에만 작성
CREATE POLICY "Users can create in their organization"
  ON company_boards FOR INSERT
  WITH CHECK (
    -- 자기 조직
    organization_id IN (
      SELECT organization_id
      FROM profiles
      WHERE id = auth.uid()
    )
    AND
    -- 작성자는 본인
    author_id = auth.uid()
  );

-- 3. UPDATE 정책: 본인 글만 수정
CREATE POLICY "Users can update their own posts"
  ON company_boards FOR UPDATE
  USING (
    deleted_at IS NULL
    AND author_id = auth.uid()
  )
  WITH CHECK (
    deleted_at IS NULL
    AND author_id = auth.uid()
  );

-- 4. DELETE 정책: 본인 글만 삭제 (또는 Admin)
CREATE POLICY "Users can delete their own posts or admin can delete any"
  ON company_boards FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      author_id = auth.uid()
      OR
      EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );

-- ============================================
-- 함수: 댓글 개수 계산
-- ============================================
CREATE OR REPLACE FUNCTION get_board_reply_count(board_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM company_boards
  WHERE parent_id = board_id
  AND deleted_at IS NULL;
$$ LANGUAGE sql STABLE;

-- ============================================
-- 함수: 조회수 증가
-- ============================================
CREATE OR REPLACE FUNCTION increment_board_view_count(board_id UUID)
RETURNS VOID AS $$
  UPDATE company_boards
  SET view_count = view_count + 1
  WHERE id = board_id;
$$ LANGUAGE sql VOLATILE;

-- ============================================
-- 트리거: updated_at 자동 갱신
-- ============================================
CREATE OR REPLACE FUNCTION update_company_boards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_boards_updated_at
  BEFORE UPDATE ON company_boards
  FOR EACH ROW
  EXECUTE FUNCTION update_company_boards_updated_at();

-- ============================================
-- Supabase Storage Bucket (이미지 업로드용)
-- ============================================
-- Supabase Dashboard에서 생성:
-- Bucket name: company-boards
-- Public: false
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- Storage RLS 정책 (Supabase Dashboard에서 설정):
-- 1. SELECT: 자기 조직 또는 Admin
-- 2. INSERT: 자기 조직에만 업로드
-- 3. UPDATE/DELETE: 본인이 업로드한 파일만

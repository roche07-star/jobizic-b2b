-- Add assigned_to columns for ownership tracking
-- Supabase SQL Editor에서 실행하세요

-- 1. candidates 테이블에 assigned_to 컬럼 추가
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_candidates_assigned_to ON candidates(assigned_to);

COMMENT ON COLUMN candidates.assigned_to IS '담당 헤드헌터 이메일';

-- 2. pipeline 테이블에 assigned_to 컬럼 추가
ALTER TABLE pipeline
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_pipeline_assigned_to ON pipeline(assigned_to);

COMMENT ON COLUMN pipeline.assigned_to IS '담당 헤드헌터 이메일 (JD 담당자와 다를 수 있음)';

-- 3. 기존 데이터 마이그레이션 (선택사항)
-- 기존 JD의 created_by를 pipeline의 assigned_to에 복사
-- UPDATE pipeline p
-- SET assigned_to = jd.created_by
-- FROM job_descriptions jd
-- WHERE p.jd_id = jd.id AND p.assigned_to IS NULL;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ assigned_to 컬럼이 추가되었습니다.';
  RAISE NOTICE '   - candidates.assigned_to';
  RAISE NOTICE '   - pipeline.assigned_to';
END $$;

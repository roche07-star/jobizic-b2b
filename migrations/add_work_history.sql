-- 후보자 테이블에 경력사항 필드 추가
-- 구조: [{ company: "회사명", position: "직무", start_date: "2020-01", end_date: "2023-12", duration_years: 3.9 }]

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS work_history JSONB DEFAULT '[]'::jsonb;

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_candidates_work_history ON candidates USING GIN(work_history);

COMMENT ON COLUMN candidates.work_history IS '경력사항 (회사명, 직무, 재직기간 등)';

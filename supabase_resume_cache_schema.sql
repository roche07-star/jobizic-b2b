-- Resume Text Extraction Cache
-- PDF/DOCX 텍스트 추출 결과 캐싱 (속도 개선)

CREATE TABLE IF NOT EXISTS resume_text_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 파일 식별
  file_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 해시
  file_name VARCHAR(255),
  file_size INTEGER,

  -- 추출 결과
  extracted_text TEXT NOT NULL,

  -- 메타데이터
  extraction_time_ms INTEGER, -- 추출 소요 시간 (밀리초)
  hit_count INTEGER DEFAULT 0, -- 캐시 히트 횟수
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_resume_cache_hash ON resume_text_cache(file_hash);
CREATE INDEX IF NOT EXISTS idx_resume_cache_created ON resume_text_cache(created_at DESC);

-- 자동 정리: 30일 이상 된 캐시 삭제 (선택)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-resume-cache', '0 3 * * *', $$
--   DELETE FROM resume_text_cache WHERE created_at < NOW() - INTERVAL '30 days';
-- $$);

-- =====================================================
-- Pipeline stage '검토' → '신규' 일괄 수정
-- 작성일: 2026-07-23
-- 담당: 디바 (미르팀)
-- =====================================================

-- 기존 '검토' stage를 '신규'로 변경
UPDATE pipeline
SET stage = '신규'
WHERE stage = '검토';

-- 결과 확인
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM pipeline
  WHERE stage = '신규';

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Pipeline stage 수정 완료!';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '검토 → 신규 변경 완료';
  RAISE NOTICE '현재 신규 단계 프로세스 수: %', updated_count;
  RAISE NOTICE '=================================================';
END $$;

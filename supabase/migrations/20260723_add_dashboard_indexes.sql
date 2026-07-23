-- =====================================================
-- 대시보드 성능 최적화를 위한 인덱스 추가
-- 예상 효과: DB 응답 시간 30-40% 단축
-- 작성일: 2026-07-23
-- 담당: 디바 + 코난 (미르팀)
-- =====================================================

-- 1. JD 테이블 인덱스
-- =====================================================

-- 대시보드에서 가장 많이 조회되는 패턴: created_by로 내 JD 조회
CREATE INDEX IF NOT EXISTS idx_jd_created_by
ON job_descriptions(created_by);

COMMENT ON INDEX idx_jd_created_by IS '대시보드: 사용자별 JD 조회 최적화';

-- 조직별 + 상태별 조회 (Admin/Owner용)
CREATE INDEX IF NOT EXISTS idx_jd_org_status
ON job_descriptions(organization_id, status);

COMMENT ON INDEX idx_jd_org_status IS '대시보드: 조직별 상태별 JD 현황 조회 최적화';

-- 최근 JD 조회 (created_at DESC)
CREATE INDEX IF NOT EXISTS idx_jd_org_created
ON job_descriptions(organization_id, created_at DESC);

COMMENT ON INDEX idx_jd_org_created IS '대시보드: 최근 JD 목록 조회 최적화';

-- 상태별 카운트 조회 최적화
CREATE INDEX IF NOT EXISTS idx_jd_status
ON job_descriptions(status)
WHERE status IN ('활성', '완료', '보류');

COMMENT ON INDEX idx_jd_status IS '대시보드: JD 상태별 통계 최적화';


-- 2. Pipeline 테이블 인덱스
-- =====================================================

-- JD별 활성 프로세스 카운트 (가장 빈번한 쿼리)
CREATE INDEX IF NOT EXISTS idx_pipeline_jd_active
ON pipeline(jd_id, is_active);

COMMENT ON INDEX idx_pipeline_jd_active IS '대시보드: JD별 활성 프로세스 카운트 최적화';

-- 조직별 활성 프로세스 조회
CREATE INDEX IF NOT EXISTS idx_pipeline_org_active
ON pipeline(organization_id, is_active);

COMMENT ON INDEX idx_pipeline_org_active IS '대시보드: 조직별 활성 프로세스 조회 최적화';

-- 이번 달 매칭 카운트 (created_at 범위 조회)
CREATE INDEX IF NOT EXISTS idx_pipeline_created
ON pipeline(created_at DESC);

COMMENT ON INDEX idx_pipeline_created IS '대시보드: 월별 매칭 통계 최적화';

-- 단계별 프로세스 카운트
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_active
ON pipeline(stage, is_active)
WHERE is_active = true;

COMMENT ON INDEX idx_pipeline_stage_active IS '대시보드: 단계별 활성 프로세스 통계 최적화';

-- 사용자별 프로세스 조회
CREATE INDEX IF NOT EXISTS idx_pipeline_created_by
ON pipeline(created_by);

COMMENT ON INDEX idx_pipeline_created_by IS '대시보드: 사용자별 프로세스 통계 최적화';


-- 3. Candidates 테이블 인덱스
-- =====================================================

-- 조직별 후보자 카운트 (COUNT 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_candidates_org
ON candidates(organization_id);

COMMENT ON INDEX idx_candidates_org IS '대시보드: 조직별 후보자 카운트 최적화';

-- 사용자별 후보자 조회
CREATE INDEX IF NOT EXISTS idx_candidates_created_by
ON candidates(created_by);

COMMENT ON INDEX idx_candidates_created_by IS '대시보드: 사용자별 후보자 통계 최적화';

-- 최근 등록 후보자 조회
CREATE INDEX IF NOT EXISTS idx_candidates_created
ON candidates(organization_id, created_at DESC);

COMMENT ON INDEX idx_candidates_created IS '대시보드: 최근 후보자 목록 조회 최적화';


-- 4. JD Interests 테이블 인덱스
-- =====================================================

-- 사용자별 관심 JD 조회 (가장 빈번한 쿼리)
CREATE INDEX IF NOT EXISTS idx_jd_interests_user
ON jd_interests(user_id);

COMMENT ON INDEX idx_jd_interests_user IS '대시보드: 사용자별 관심 JD 조회 최적화';

-- JD별 관심 등록자 수 조회
CREATE INDEX IF NOT EXISTS idx_jd_interests_jd
ON jd_interests(jd_id);

COMMENT ON INDEX idx_jd_interests_jd IS '대시보드: JD별 관심 등록자 수 조회 최적화';


-- 5. Profiles 테이블 인덱스
-- =====================================================

-- 이메일 조회 (getProfile에서 빈번)
CREATE INDEX IF NOT EXISTS idx_profiles_email
ON profiles(email);

COMMENT ON INDEX idx_profiles_email IS '대시보드: 이메일로 프로필 조회 최적화';

-- 조직별 멤버 조회
CREATE INDEX IF NOT EXISTS idx_profiles_org
ON profiles(organization_id)
WHERE is_active = true;

COMMENT ON INDEX idx_profiles_org IS '대시보드: 조직별 활성 멤버 조회 최적화';


-- =====================================================
-- 인덱스 생성 완료 확인
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE '대시보드 인덱스 생성 완료!';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'JD 테이블: 4개 인덱스';
  RAISE NOTICE 'Pipeline 테이블: 5개 인덱스';
  RAISE NOTICE 'Candidates 테이블: 3개 인덱스';
  RAISE NOTICE 'JD Interests 테이블: 2개 인덱스';
  RAISE NOTICE 'Profiles 테이블: 2개 인덱스';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '총 16개 인덱스 생성 완료';
  RAISE NOTICE '예상 성능 개선: DB 응답 시간 30-40%% 단축';
  RAISE NOTICE '=================================================';
END $$;


-- =====================================================
-- 인덱스 사용 통계 확인 쿼리 (참고용)
-- =====================================================

-- 아래 쿼리를 실행하면 인덱스가 실제로 사용되는지 확인 가능
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as "인덱스 스캔 횟수",
--   idx_tup_read as "읽은 행 수",
--   idx_tup_fetch as "fetch 된 행 수"
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY idx_scan DESC;

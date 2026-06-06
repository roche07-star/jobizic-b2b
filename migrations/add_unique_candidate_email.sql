-- 중복 후보 방지: 같은 조직 내에서 동일 이메일 후보자 중복 방지
ALTER TABLE candidates
ADD CONSTRAINT unique_email_per_org
UNIQUE (email, organization_id);

-- 기존 중복 데이터가 있을 경우 제약조건 추가 전에 정리 필요
-- 중복 확인 쿼리:
-- SELECT email, organization_id, COUNT(*) as count
-- FROM candidates
-- WHERE email IS NOT NULL
-- GROUP BY email, organization_id
-- HAVING COUNT(*) > 1;

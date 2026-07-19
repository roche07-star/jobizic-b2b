-- 최신 JD 1개의 _v2 데이터 확인
SELECT 
  id,
  company,
  position,
  _v2::text
FROM job_descriptions
WHERE _v2 IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

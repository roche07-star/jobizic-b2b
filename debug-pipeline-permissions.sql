-- 홍길동 프로필 확인
SELECT email, full_name, role, organization_id, telegram_chat_id
FROM profiles 
WHERE full_name LIKE '%홍길동%' OR email LIKE '%홍길동%';

-- 홍길동이 만든 JD 확인
SELECT id, company, position, created_by 
FROM job_descriptions 
WHERE created_by LIKE '%홍길동%';

-- 모든 파이프라인의 소유자 확인
SELECT 
  p.id,
  p.created_by as recommender,
  jd.company,
  jd.position,
  jd.created_by as jd_owner,
  c.name as candidate_name
FROM pipeline p
JOIN job_descriptions jd ON p.jd_id = jd.id
JOIN candidates c ON p.candidate_id = c.id
ORDER BY p.created_at DESC
LIMIT 10;

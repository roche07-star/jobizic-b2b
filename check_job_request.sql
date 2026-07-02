-- Eve DB에서 확인
SELECT 
  id,
  name,
  email,
  position,
  adam_analysis_data IS NOT NULL as has_analysis_data,
  LENGTH(adam_analysis_data::text) as data_size,
  created_at
FROM job_requests
WHERE email = 'roche07he@gmail.com'
ORDER BY created_at DESC
LIMIT 1;

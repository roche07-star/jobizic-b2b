-- RLS 정책에서 'headhunter' 사용 확인
SELECT schemaname, tablename, policyname, definition
FROM pg_policies
WHERE definition LIKE '%headhunter%'
ORDER BY tablename, policyname;

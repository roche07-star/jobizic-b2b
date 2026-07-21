-- notifications 테이블에 DELETE 정책 추가
-- Supabase SQL Editor에서 실행하세요

-- 자신의 알림만 삭제 가능
CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ notifications DELETE 정책이 추가되었습니다.';
  RAISE NOTICE '   - 사용자는 자신의 알림만 삭제 가능';
END $$;

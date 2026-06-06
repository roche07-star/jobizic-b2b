-- Add DELETE policy for notifications
-- Users can delete their own notifications

-- 자신의 알림만 삭제 가능
CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ notifications DELETE 정책이 추가되었습니다.';
  RAISE NOTICE '   - 사용자는 자신의 알림을 삭제할 수 있습니다.';
END $$;

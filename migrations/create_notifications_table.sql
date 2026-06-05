-- Notifications table for real-time alerts
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 알림 대상
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 알림 타입
  type VARCHAR(50) NOT NULL, -- 'pipeline_stage', 'new_candidate', 'new_jd', 'mention', 'assignment'

  -- 알림 내용
  title VARCHAR(255) NOT NULL,
  message TEXT,

  -- 연관 데이터
  related_id UUID, -- JD ID, Candidate ID, Pipeline ID 등
  related_type VARCHAR(50), -- 'jd', 'candidate', 'pipeline'

  -- 액션 URL (클릭 시 이동할 경로)
  action_url VARCHAR(500),

  -- 상태
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- 발신자 정보
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name VARCHAR(255),

  -- 추가 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- RLS (Row Level Security) 활성화
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 자신의 알림만 조회 가능
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- 자신의 알림만 업데이트 가능 (읽음 처리)
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 시스템이 알림 생성 (service_role로만 생성)
-- Admin API에서 service_role key로 생성할 것

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ notifications 테이블이 생성되었습니다.';
  RAISE NOTICE '   - 알림 타입: pipeline_stage, new_candidate, new_jd, mention, assignment';
  RAISE NOTICE '   - RLS 정책 적용: 사용자는 자신의 알림만 조회/수정 가능';
END $$;

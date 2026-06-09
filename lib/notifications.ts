import { supabaseAdmin } from './supabase-admin'

export type NotificationType =
  | 'pipeline_stage'
  | 'new_candidate'
  | 'new_jd'
  | 'mention'
  | 'assignment'
  | 'board_reply'

interface CreateNotificationParams {
  userId: string // 알림 받을 사용자 ID
  type: NotificationType
  title: string
  message?: string
  relatedId?: string
  relatedType?: 'jd' | 'candidate' | 'pipeline' | 'board'
  actionUrl?: string
  senderId?: string
  senderName?: string
  metadata?: Record<string, any>
}

/**
 * 알림 생성 헬퍼 함수
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        related_id: params.relatedId,
        related_type: params.relatedType,
        action_url: params.actionUrl,
        sender_id: params.senderId,
        sender_name: params.senderName,
        metadata: params.metadata || {},
      })
      .select()
      .single()

    if (error) {
      console.error('[createNotification] Error:', error)
      return null
    }

    return data
  } catch (e) {
    console.error('[createNotification] Exception:', e)
    return null
  }
}

/**
 * 조직의 모든 활성 멤버에게 알림 전송
 */
export async function notifyOrganizationMembers(
  organizationId: string,
  params: Omit<CreateNotificationParams, 'userId'>,
  excludeUserId?: string
) {
  try {
    // 조직의 모든 활성 멤버 조회
    const { data: members } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (!members || members.length === 0) {
      return []
    }

    // 제외할 사용자 필터링
    const targetMembers = excludeUserId
      ? members.filter(m => m.id !== excludeUserId)
      : members

    // 각 멤버에게 알림 생성
    const notifications = await Promise.all(
      targetMembers.map(member =>
        createNotification({
          ...params,
          userId: member.id,
        })
      )
    )

    return notifications.filter(n => n !== null)
  } catch (e) {
    console.error('[notifyOrganizationMembers] Exception:', e)
    return []
  }
}

/**
 * 특정 역할의 멤버들에게 알림 전송
 */
export async function notifyMembersByRole(
  organizationId: string,
  roles: string[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  try {
    // 조직의 특정 역할 멤버 조회
    const { data: members } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .in('role', roles)

    if (!members || members.length === 0) {
      return []
    }

    // 각 멤버에게 알림 생성
    const notifications = await Promise.all(
      members.map(member =>
        createNotification({
          ...params,
          userId: member.id,
        })
      )
    )

    return notifications.filter(n => n !== null)
  } catch (e) {
    console.error('[notifyMembersByRole] Exception:', e)
    return []
  }
}

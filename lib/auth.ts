import { getSupabaseBrowser } from './supabase-browser'

export interface Permissions {
  jd: { read: boolean; write: boolean }
  candidate: { read: boolean; write: boolean }
  pipeline: { read: boolean; write: boolean }
  recommendation: { execute: boolean }
  board: { read: boolean; write: boolean }
}

export interface Profile {
  id: string
  organization_id: string | null
  email: string
  full_name: string | null
  role: 'admin' | 'owner' | 'headhunter' | 'operator' | 'manager'
  client_company_name: string | null
  allowed_jd_ids: string[] | null
  is_active: boolean
  password_set?: boolean
  permissions?: Permissions | null
  organization?: {
    id: string
    name: string
    type: string
  } | null
  // Telegram Integration
  telegram_chat_id?: number | null
  telegram_username?: string | null
  telegram_verified_at?: string | null
  // Browser Notifications
  browser_notifications_enabled?: boolean
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabaseBrowser().auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // 에러 메시지 한글화
    if (error.message === 'Invalid login credentials') {
      throw new Error('이메일 또는 비밀번호가 틀렸습니다.')
    }
    throw error
  }

  return data
}

export async function signOut() {
  // 캐시 완전 삭제
  localStorage.clear()
  sessionStorage.clear()

  const { error } = await getSupabaseBrowser().auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await getSupabaseBrowser().auth.getSession()
  return data.session
}

export async function getProfile(): Promise<Profile | null> {
  const session = await getSession()
  if (!session) {
    console.log('[getProfile] No session')
    return null
  }

  console.log('[getProfile] Fetching profile for user:', session.user.id, session.user.email)

  const { data, error} = await getSupabaseBrowser()
    .from('profiles')
    .select(`
      *,
      organization:organizations(id, name, type)
    `)
    .eq('id', session.user.id)
    .single()

  if (error) {
    console.error('[getProfile] Profile fetch error:', error)
    console.error('[getProfile] Error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    })
    return null
  }

  console.log('[getProfile] Profile found:', data?.email, data?.role)
  return data
}

export async function getCurrentOrganizationId(): Promise<string | null> {
  const profile = await getProfile()
  return profile?.organization_id ?? null
}

// 권한 체크 헬퍼 함수들
export function isJobizicManager(profile: Profile | null): boolean {
  return profile?.role === 'manager' && profile?.organization?.type === 'platform'
}

export function isEnterpriseManager(profile: Profile | null): boolean {
  return profile?.role === 'manager' && profile?.organization?.type === 'enterprise'
}

export function canManageOrganizations(profile: Profile | null): boolean {
  // 조직 관리 권한: admin, owner, enterprise manager만
  if (!profile) return false
  if (profile.role === 'admin') return true
  if (profile.role === 'owner') return true
  if (isEnterpriseManager(profile)) return true
  return false
}

export function canModifyData(profile: Profile | null): boolean {
  // 데이터 수정 권한: JOBIZIC Manager 제외한 모든 role
  if (!profile) return false
  if (isJobizicManager(profile)) return false
  return true
}

// 세부 권한 체크 함수들
export function hasPermission(
  profile: Profile | null,
  resource: 'jd' | 'candidate' | 'pipeline' | 'board',
  action: 'read' | 'write'
): boolean {
  if (!profile) return false

  // Admin은 모든 권한
  if (profile.role === 'admin') return true

  // Owner, Headhunter, Operator, Enterprise Manager는 모든 권한
  if (profile.role === 'owner' || profile.role === 'headhunter' || profile.role === 'operator') return true
  if (isEnterpriseManager(profile)) return true

  // JOBIZIC Manager는 permissions 체크
  if (isJobizicManager(profile) && profile.permissions) {
    return profile.permissions[resource]?.[action] ?? false
  }

  return false
}

export function canExecuteRecommendation(profile: Profile | null): boolean {
  if (!profile) return false

  // Admin, Owner, Headhunter는 항상 가능
  if (profile.role === 'admin' || profile.role === 'owner' || profile.role === 'headhunter') return true
  if (isEnterpriseManager(profile)) return true

  // JOBIZIC Manager는 permissions 체크
  if (isJobizicManager(profile) && profile.permissions) {
    return profile.permissions.recommendation?.execute ?? false
  }

  return false
}

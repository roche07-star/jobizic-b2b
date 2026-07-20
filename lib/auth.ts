import { getSupabaseBrowser } from './supabase-browser'

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
  organization?: {
    id: string
    name: string
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
      organization:organizations(id, name)
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

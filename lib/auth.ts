import { supabase } from './supabase'

export interface Profile {
  id: string
  organization_id: string | null
  email: string
  full_name: string | null
  role: 'admin' | 'owner' | 'headhunter' | 'searcher' | 'client' | 'client_owner' | 'client_pm' | 'client_searcher'
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
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
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

  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getProfile(): Promise<Profile | null> {
  const session = await getSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      organization:organizations(id, name)
    `)
    .eq('id', session.user.id)
    .single()

  if (error) {
    console.error('Profile fetch error:', error)
    return null
  }

  return data
}

export async function getCurrentOrganizationId(): Promise<string | null> {
  const profile = await getProfile()
  return profile?.organization_id ?? null
}

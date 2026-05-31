import { supabase } from './supabase'

export interface Profile {
  id: string
  organization_id: string | null
  email: string
  full_name: string | null
  role: 'admin' | 'headhunter' | 'client'
  client_company_name: string | null
  allowed_jd_ids: string[] | null
  is_active: boolean
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
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
    .select('*')
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

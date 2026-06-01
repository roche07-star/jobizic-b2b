import { supabaseAdmin } from './supabase-admin'
import { cookies } from 'next/headers'

export async function getAuthenticatedUser() {
  const cookieStore = await cookies()

  // Supabase 쿠키에서 세션 토큰 읽기
  const authCookie = cookieStore.get('sb-fwmjqfadsrzbzkpwbwue-auth-token')

  if (!authCookie) {
    throw new Error('Unauthorized')
  }

  let session
  try {
    session = JSON.parse(authCookie.value)
  } catch {
    throw new Error('Unauthorized')
  }

  if (!session?.access_token) {
    throw new Error('Unauthorized')
  }

  // access_token으로 사용자 확인
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(session.access_token)

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return user
}

export async function getUserProfile() {
  const user = await getAuthenticatedUser()

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new Error('Profile not found')
  }

  return profile
}

export async function getUserOrganizationId(): Promise<string> {
  const profile = await getUserProfile()

  if (!profile.organization_id) {
    throw new Error('No organization assigned')
  }

  return profile.organization_id
}

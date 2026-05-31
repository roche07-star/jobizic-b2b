import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function getAuthenticatedUser() {
  const supabase = createRouteHandlerClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Unauthorized')
  }

  return session.user
}

export async function getUserProfile() {
  const user = await getAuthenticatedUser()
  const supabase = createRouteHandlerClient({ cookies })

  const { data: profile, error } = await supabase
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

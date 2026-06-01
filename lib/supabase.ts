import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  // RLS를 존중하기 위해 ANON_KEY만 사용

if (!url) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
}

if (!key) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
}

export const supabase = createClient(url, key)

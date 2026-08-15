import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const jobId = 'fbfef05e-ce22-4b15-a171-aee67b9bfb36'

console.log('🔍 Fetching job error details...\n')

const { data: job, error } = await supabase
  .from('jobs')
  .select('*')
  .eq('id', jobId)
  .single()

if (error) {
  console.error('❌ Query error:', error.message)
  process.exit(1)
}

if (!job) {
  console.error('❌ Job not found')
  process.exit(1)
}

console.log('📋 Job Details:')
console.log('=====================================')
console.log('ID:', job.id)
console.log('Type:', job.job_type)
console.log('Status:', job.status)
console.log('Progress:', job.progress)
console.log('Message:', job.message)
console.log('\n❌ Error:')
console.log('-------------------------------------')
console.log(job.error || 'No error message')
console.log('\n📥 Input:')
console.log('-------------------------------------')
console.log(JSON.stringify(job.input, null, 2))
console.log('\n📤 Result:')
console.log('-------------------------------------')
console.log(job.result ? JSON.stringify(job.result, null, 2) : 'No result')
console.log('\n⏰ Timestamps:')
console.log('-------------------------------------')
console.log('Created:', job.created_at)
console.log('Completed:', job.completed_at)
console.log('User:', job.user_email)

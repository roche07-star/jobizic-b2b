CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS job_seeker_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  adam_user_email text NOT NULL,
  adam_user_name text,
  adam_application_id text NOT NULL,
  company text NOT NULL,
  position text NOT NULL,
  status text,
  request_message text,
  assigned_headhunter_id uuid,
  assigned_at timestamptz,
  request_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_seeker_requests_status ON job_seeker_requests(request_status, created_at);
CREATE INDEX IF NOT EXISTS idx_job_seeker_requests_email ON job_seeker_requests(adam_user_email);

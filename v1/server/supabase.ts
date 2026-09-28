import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Copy server/.env.example to server/.env and fill them in.',
  )
}

// Service-role key: bypasses RLS, so this must only ever run on the server, never the browser.
export const supabase = createClient(url, key, { auth: { persistSession: false } })

/**
 * Supabase browser client — used for authentication only.
 *
 * Financial data still flows through the FastAPI backend (services/api.js);
 * this client just manages the user's auth session (sign in/up, password
 * reset, token refresh) and hands its JWT to the API request interceptor.
 *
 * Uses the ANON (public) key — never the service-role key. All data access is
 * gated by Row Level Security on the backend.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loud in dev rather than producing confusing 401s later.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — auth will not work. ' +
      'Copy frontend/.env.example to .env and fill them in.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Needed so the password-recovery / email-confirmation links (which carry
    // the token in the URL hash) are picked up when the user lands back here.
    detectSessionInUrl: true,
  },
})

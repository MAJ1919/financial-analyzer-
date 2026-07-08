/**
 * Supabase client — used on the FRONTEND only for Realtime auto-save
 * confirmation feedback (SRS §4.3).
 * 
 * All data mutations go through the FastAPI backend.
 * The Supabase JS client here is used only for:
 *   - Realtime subscriptions (auto-save confirmation toasts)
 *   - Optionally: auth session management in future versions
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[supabase.js] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. ' +
    'Realtime features will be unavailable.'
  )
}

export const supabase = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || ''
)

/**
 * Subscribe to real-time changes on a specific project row.
 * Calls `onUpdate` whenever the project is updated (e.g. auto-save confirmation).
 *
 * @param {string} projectId
 * @param {function} onUpdate - callback receiving the updated record
 * @returns {function} unsubscribe function
 */
export function subscribeToProject(projectId, onUpdate) {
  const channel = supabase
    .channel(`project-${projectId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${projectId}`,
      },
      (payload) => onUpdate(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

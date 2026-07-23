import { create } from 'zustand'
import { supabase } from '../services/supabaseClient'

/**
 * Auth session store — the single source of truth for "who is logged in".
 *
 * Kept separate from projectStore (one store per concern). `initialize()` is
 * called once at app startup: it hydrates the current session and subscribes to
 * Supabase auth changes (login, logout, token refresh) so the store stays in
 * sync without any manual polling.
 */
export const useAuthStore = create((set) => ({
  session: null,
  user: null,
  // True until the first getSession() resolves — routes wait on this so we
  // don't bounce an already-logged-in user to /login on a hard refresh.
  initializing: true,

  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    set({ session, user: session?.user ?? null, initializing: false })

    // Keep the store live. onAuthStateChange fires on sign-in, sign-out,
    // token refresh, and password-recovery link handling.
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null })
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null })
  },
}))

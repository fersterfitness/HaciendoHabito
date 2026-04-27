import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

// Bump this string whenever a deployment has breaking changes (schema migration,
// new RLS policies, etc.) to force all existing sessions to re-authenticate.
const SESSION_VERSION = 'v1'
const SESSION_VERSION_KEY = 'hh-session-v'

const AUTH_TIMEOUT_MS = 5000

export function useAuthInit() {
  const { setUser, setSession, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    let mounted = true
    let done = false

    function finish(success: boolean) {
      if (!done && mounted) {
        done = true
        if (!success) reset()
        else setLoading(false)
      }
    }

    const timer = setTimeout(() => {
      console.warn('[Auth] Init timeout — resetting')
      finish(false)
    }, AUTH_TIMEOUT_MS)

    async function run() {
      // 0. Session version gate — bump SESSION_VERSION above to force re-login.
      const storedVersion = localStorage.getItem(SESSION_VERSION_KEY)
      if (storedVersion !== SESSION_VERSION) {
        localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION)
        await supabase.auth.signOut().catch(() => {})
        clearTimeout(timer)
        finish(false)
        return
      }

      // 1. Read cached session from localStorage (no network, instant).
      const { data: { session: cached }, error: sessionError } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError || !cached?.user) {
        await supabase.auth.signOut().catch(() => {})
        clearTimeout(timer)
        finish(false)
        return
      }

      // 2. Validate the cached session server-side by refreshing the token.
      //    This catches revoked or otherwise invalidated sessions that still
      //    look valid locally. If the network is down, we fall back to cached.
      const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession()

      if (!mounted) return

      if (refreshError) {
        const isAuthError =
          refreshError.status === 400 ||
          refreshError.status === 401 ||
          refreshError.message?.toLowerCase().includes('refresh_token') ||
          refreshError.message?.toLowerCase().includes('invalid')

        if (isAuthError) {
          // Token is truly invalid — sign out cleanly.
          await supabase.auth.signOut().catch(() => {})
          clearTimeout(timer)
          finish(false)
          return
        }
        // Network or server error — proceed with the cached session so the
        // app still works offline / on bad connections.
        setSession(cached)
        setUser(cached.user)
      } else {
        const finalSession = refreshed ?? cached
        setSession(finalSession)
        setUser(finalSession.user)
      }

      // 3. Fetch profile (non-fatal).
      try {
        const userId = (refreshed ?? cached).user.id
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (mounted) {
          if (!profileError && data) setProfile(data)
          else setProfile(null)
        }
      } catch {
        if (mounted) setProfile(null)
      }

      clearTimeout(timer)
      finish(true)
    }

    run().catch(() => {
      clearTimeout(timer)
      finish(false)
    })

    // Listen for subsequent auth events (login from another tab, logout, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'INITIAL_SESSION') return

        if (event === 'SIGNED_OUT' || !session?.user) {
          reset()
          return
        }

        setSession(session)
        setUser(session.user)

        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          if (mounted && data) setProfile(data)
        } catch {
          // non-fatal
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useAuth() {
  return useAuthStore()
}

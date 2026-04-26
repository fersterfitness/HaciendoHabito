import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const AUTH_TIMEOUT_MS = 8000

export function useAuthInit() {
  const { setUser, setSession, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    let mounted = true
    let done = false // prevents double-resolution (e.g. StrictMode + token refresh racing)

    function finish(success: boolean) {
      if (!done && mounted) {
        done = true
        if (!success) reset()
        else setLoading(false)
      }
    }

    // Safety net: if the full init hasn't completed in time, bail out.
    const timer = setTimeout(() => {
      console.warn('[Auth] Init timeout — resetting')
      finish(false)
    }, AUTH_TIMEOUT_MS)

    async function run() {
      // 1. Read session from localStorage (sync path via Supabase cache).
      const { data: { session }, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error || !session?.user) {
        // Clear any stale token from localStorage so the next reload doesn't
        // hit this same path again.
        await supabase.auth.signOut().catch(() => {})
        clearTimeout(timer)
        finish(false)
        return
      }

      // 2. Valid session — set auth state immediately so the guard can proceed.
      setSession(session)
      setUser(session.user)

      // 3. Fetch profile. Errors are non-fatal (loading still resolves).
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
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
      // Unexpected error anywhere in the chain — still resolve loading.
      clearTimeout(timer)
      finish(false)
    })

    // Listen for subsequent auth events (login from another tab, logout, token refresh).
    // These never touch the loading state — loading is only relevant on the initial load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'INITIAL_SESSION') return // handled by getSession() above

        if (event === 'SIGNED_OUT' || !session?.user) {
          reset()
          return
        }

        setSession(session)
        setUser(session.user)

        // Refresh profile silently.
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          if (mounted && data) setProfile(data)
        } catch {
          // non-fatal — profile already set from initial load
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

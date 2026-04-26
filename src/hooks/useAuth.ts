import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const AUTH_TIMEOUT_MS = 8000

export function useAuthInit() {
  const { setUser, setSession, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    let mounted = true

    // Safety net: if auth takes too long (corrupted storage, network issue),
    // force reset so the user sees the login page instead of a frozen spinner.
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] Init timeout — clearing session and redirecting to login')
        supabase.auth.signOut().finally(() => {
          if (mounted) reset()
        })
      }
    }, AUTH_TIMEOUT_MS)

    // Use ONLY onAuthStateChange — it fires INITIAL_SESSION on first load,
    // avoiding the race condition caused by calling getSession() separately.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      clearTimeout(timeout)

      // If the refresh token is invalid/expired, sign out cleanly so the
      // browser storage gets wiped and the user sees the login page.
      if (event === 'TOKEN_REFRESHED' && !session) {
        await supabase.auth.signOut()
        if (mounted) reset()
        return
      }

      if (session?.user) {
        setSession(session)
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        reset()
      }
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId: string) {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('[Auth] Failed to load profile:', err)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }
}

export function useAuth() {
  return useAuthStore()
}

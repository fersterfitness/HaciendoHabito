import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

// ─── Session version ──────────────────────────────────────────────────────────
// Bump to force re-authentication after breaking deployments.
// Runs synchronously at module load — before any React render or effect.
const SESSION_VERSION = 'v1'
const SESSION_VERSION_KEY = 'hh-session-v'

let sessionVersionChanged = false
try {
  if (localStorage.getItem(SESSION_VERSION_KEY) !== SESSION_VERSION) {
    localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION)
    localStorage.removeItem('hh-auth')
    sessionVersionChanged = true
  }
} catch {
  // private browsing / SSR
}

// ─── Direct localStorage read ─────────────────────────────────────────────────
// Supabase JS v2 uses a Web Lock (navigator.locks) on every getSession() and
// onAuthStateChange() call. With StrictMode's double-invoke those lock requests
// queue up and can hang indefinitely. Reading directly from localStorage
// bypasses the lock entirely — no network, no contention.
function readLocalSession(): Session | null {
  try {
    const raw = localStorage.getItem('hh-auth')
    if (!raw) return null
    const data = JSON.parse(raw) as Session & { expires_at?: number }
    if (!data.access_token || !data.user?.id) return null
    // expires_at is Unix seconds; allow 60 s buffer before calling it expired.
    if (data.expires_at && data.expires_at - 60 < Date.now() / 1000) return null
    return data
  } catch {
    return null
  }
}

// Deduplicate refreshSession() so StrictMode's double-invoke doesn't fire
// two concurrent network requests.
type RefreshResult = Awaited<ReturnType<typeof supabase.auth.refreshSession>>
let _refreshPromise: Promise<RefreshResult> | null = null

function sharedRefreshSession(): Promise<RefreshResult> {
  if (!_refreshPromise) {
    _refreshPromise = supabase.auth.refreshSession()
    _refreshPromise.finally(() => { _refreshPromise = null })
  }
  return _refreshPromise
}

// ─── Module-level auth subscription ──────────────────────────────────────────
// onAuthStateChange() fires INITIAL_SESSION internally when you subscribe, and
// that emission acquires the Supabase Web Lock. With StrictMode's double-invoke
// two subscriptions are created in rapid succession; both try to acquire the
// lock and one "steals" it from the other, producing the error toast:
//   "Lock 'lock:hh-auth' was released because another request stole it"
//
// Fix: keep ONE subscription alive at module level. Callbacks registered by
// the effect are stored in a Set so they're always using the same subscription.
type AuthCallback = Parameters<Parameters<typeof supabase.auth.onAuthStateChange>[0]>
type AuthEvent = AuthCallback[0]
type AuthSession = AuthCallback[1]
type Listener = (event: AuthEvent, session: AuthSession) => void

const _listeners = new Set<Listener>()

// Create the singleton subscription once (lazy, on first import use).
;(function initSubscription() {
  supabase.auth.onAuthStateChange((event, session) => {
    for (const fn of _listeners) {
      fn(event, session)
    }
  })
})()

// ─── Timeout ──────────────────────────────────────────────────────────────────
const AUTH_TIMEOUT_MS = 10000

// ─── Hook ─────────────────────────────────────────────────────────────────────
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
      if (sessionVersionChanged) {
        clearTimeout(timer)
        finish(false)
        return
      }

      // ── Fast path: valid non-expired session in localStorage (no lock, no network) ──
      const localSession = readLocalSession()
      if (localSession) {
        if (!mounted) return
        setSession(localSession)
        setUser(localSession.user)
        clearTimeout(timer)
        finish(true)

        // Background profile fetch — does not block the loading state.
        try {
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', localSession.user.id)
            .single()
          if (mounted) {
            if (!profileError && data) setProfile(data)
            else setProfile(null)
          }
        } catch {
          if (mounted) setProfile(null)
        }
        return
      }

      // ── Slow path: token missing or expired — network refresh ─────────────
      let session: Session | null = null
      try {
        const { data, error } = await sharedRefreshSession()
        if (!mounted) return
        if (!error && data.session?.user) session = data.session
      } catch {
        // network error — fall through to finish(false)
      }

      if (!mounted) return

      if (!session) {
        clearTimeout(timer)
        finish(false)
        return
      }

      setSession(session)
      setUser(session.user)
      clearTimeout(timer)
      finish(true)

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
    }

    run().catch(() => {
      clearTimeout(timer)
      finish(false)
    })

    // Register listener on the singleton subscription (no new lock acquisition).
    const listener: Listener = async (event, session) => {
      if (!mounted) return
      if (event === 'INITIAL_SESSION') return

      if (event === 'SIGNED_OUT' || !session?.user) {
        reset()
        return
      }

      setSession(session)
      setUser(session.user)

      if (!done) {
        clearTimeout(timer)
        finish(true)
      }

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

    _listeners.add(listener)

    return () => {
      mounted = false
      clearTimeout(timer)
      _listeners.delete(listener)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useAuth() {
  return useAuthStore()
}

import { create } from 'zustand'
import type { UseBoundStore, StoreApi } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

type AuthStore = UseBoundStore<StoreApi<AuthState>>

// Only show the loading spinner if there's an existing session token to restore.
const hasStoredSession = (() => {
  try { return !!localStorage.getItem('hh-auth') } catch { return false }
})()

function createStore(): AuthStore {
  return create<AuthState>((set) => ({
    user: null,
    session: null,
    profile: null,
    loading: hasStoredSession,
    setUser: (user) => set({ user }),
    setSession: (session) => set({ session }),
    setProfile: (profile) => set({ profile }),
    setLoading: (loading) => set({ loading }),
    reset: () => set({ user: null, session: null, profile: null, loading: false }),
  }))
}

// In development, cache the store on the window object so that every time Vite
// HMR re-evaluates this module (which happens whenever ANY file in the import
// chain that leads here changes), we reuse the SAME Zustand instance instead of
// creating a fresh one with loading:true.
//
// Without this, a code change in AuthGuard → useAuth → authStore triggers a
// module re-evaluation that creates a new store. React components subscribe to
// the new store (loading:true) while the old useAuthInit closure still holds
// references to the OLD store's setters — so setLoading(false) never reaches
// the new store and the spinner loops forever.
const _win = window as { __hh_auth_store__?: AuthStore }

export const useAuthStore: AuthStore =
  _win.__hh_auth_store__ ??
  (() => {
    const store = createStore()
    _win.__hh_auth_store__ = store
    return store
  })()

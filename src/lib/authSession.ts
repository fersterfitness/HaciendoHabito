/** Debe coincidir con `storageKey` en `lib/supabase.ts`. */
export const AUTH_STORAGE_KEY = 'hh-auth'

export function clearStoredAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // private browsing
  }
}

export function isLoginRoute(): boolean {
  return typeof window !== 'undefined' && window.location.pathname === '/login'
}

/** Debe coincidir con `storageKey` en `lib/supabase.ts`. */
export const AUTH_STORAGE_KEY = 'hh-auth'

/** Copia del perfil para pintar el menú del rol al refrescar, sin esperar a la red. */
const PROFILE_CACHE_KEY = 'hh-profile'

/** Copia de la caché de datos (TanStack Query) guardada en el navegador. */
export const QUERY_CACHE_STORAGE_KEY = 'hh-query-cache'

export function clearStoredAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(PROFILE_CACHE_KEY)
    localStorage.removeItem(QUERY_CACHE_STORAGE_KEY)
  } catch {
    // private browsing
  }
}

export function readCachedProfile<T extends { id: string }>(userId: string): T | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as T
    return p?.id === userId ? p : null
  } catch {
    return null
  }
}

export function writeCachedProfile(profile: { id: string } | null): void {
  try {
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
    else localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {
    // sin storage: se vuelve a pedir en cada carga
  }
}

export function isLoginRoute(): boolean {
  return typeof window !== 'undefined' && window.location.pathname === '/login'
}

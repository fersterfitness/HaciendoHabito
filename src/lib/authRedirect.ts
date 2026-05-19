/** Ruta pública donde Supabase redirige tras recovery / magic link. */
export const AUTH_RESET_PASSWORD_PATH = '/reset-password'

/**
 * URL de redirección para emails de auth (recovery, etc.).
 * Usa el origen actual (localhost:5174, Vercel, etc.) para que dev no dependa del Site URL fijo del dashboard.
 */
export function getAuthRedirectUrl(path: string = AUTH_RESET_PASSWORD_PATH): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const base = window.location.origin.replace(/\/$/, '')
    const p = path.startsWith('/') ? path : `/${path}`
    return `${base}${p}`
  }
  const site = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim()
  if (site) {
    const base = site.replace(/\/$/, '')
    const p = path.startsWith('/') ? path : `/${path}`
    return `${base}${p}`
  }
  return `http://localhost:5173${path.startsWith('/') ? path : `/${path}`}`
}

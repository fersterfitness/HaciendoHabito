/** sessionStorage: el usuario debe completar /reset-password antes de usar el panel. */
export const PASSWORD_RECOVERY_PENDING_KEY = 'hh-password-recovery'

export function isPasswordRecoveryPending(): boolean {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_PENDING_KEY) === '1'
  } catch {
    return false
  }
}

export function setPasswordRecoveryPending(pending: boolean): void {
  try {
    if (pending) sessionStorage.setItem(PASSWORD_RECOVERY_PENDING_KEY, '1')
    else sessionStorage.removeItem(PASSWORD_RECOVERY_PENDING_KEY)
  } catch {
    // private browsing
  }
}

/** Hash del mail de Supabase: #access_token=...&type=recovery */
export function isPasswordRecoveryHash(): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return false
  const params = new URLSearchParams(raw)
  if (params.get('type') === 'recovery') return true
  return params.has('access_token') && !params.get('error')
}

export function isPasswordRecoveryRoute(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname === '/reset-password'
}

/** En /reset-password con tokens en el hash: no restaurar sesión vieja de localStorage. */
export function isPasswordRecoveryLanding(): boolean {
  return isPasswordRecoveryRoute() && isPasswordRecoveryHash()
}

/**
 * Registro de errores del frontend en la tabla `client_errors` (solo con sesión iniciada).
 * Límite por sesión y sin duplicados, para no llenar la base si algo falla en bucle.
 */

import { supabase } from '@/lib/supabase'

type ErrorKind = 'render' | 'error' | 'unhandledrejection'

const MAX_PER_SESSION = 20
const sent = new Set<string>()
let count = 0

function toError(reason: unknown): Error {
  if (reason instanceof Error) return reason
  return new Error(typeof reason === 'string' ? reason : JSON.stringify(reason)?.slice(0, 500) ?? 'Error desconocido')
}

export async function reportError(reason: unknown, kind: ErrorKind = 'error'): Promise<void> {
  if (import.meta.env.DEV) return
  const err = toError(reason)
  const key = `${kind}:${err.message}`
  if (sent.has(key) || count >= MAX_PER_SESSION) return
  sent.add(key)
  count += 1
  try {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id
    if (!userId) return
    await supabase.from('client_errors').insert({
      user_id: userId,
      kind,
      message: err.message.slice(0, 1000) || 'Error sin mensaje',
      stack: err.stack?.slice(0, 8000) ?? null,
      url: window.location.href.slice(0, 1000),
      user_agent: navigator.userAgent.slice(0, 500),
      release: (import.meta.env.VITE_RELEASE as string | undefined)?.slice(0, 100) ?? null,
    })
  } catch {
    /* el registro de errores nunca tiene que romper la app */
  }
}

/** Errores que se escapan de React (eventos, promesas sin catch). */
export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (e) => void reportError(e.error ?? e.message, 'error'))
  window.addEventListener('unhandledrejection', (e) => void reportError(e.reason, 'unhandledrejection'))
}

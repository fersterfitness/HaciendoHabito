import { supabase } from '@/lib/supabase'

const STORAGE_TOKEN = 'hh_intake_access_token'
const STORAGE_PLAN = 'hh_intake_access_plan'
const STORAGE_EMAIL = 'hh_intake_access_email'

function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function readStore(key: string): string | null {
  try {
    const local = localStorage.getItem(key)?.trim()
    if (local) return local
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem(key)?.trim() || null
  } catch {
    return null
  }
}

function clearStore(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export type WebIntakeAccessStatus = 'pending' | 'approved' | 'denied'

export function saveIntakeAccessSession(requestToken: string, planSlug: string, email?: string): void {
  writeStore(STORAGE_TOKEN, requestToken)
  writeStore(STORAGE_PLAN, planSlug)
  if (email?.trim()) writeStore(STORAGE_EMAIL, email.trim().toLowerCase())
}

export function readIntakeAccessSession(): { token: string; planSlug: string } | null {
  const token = readStore(STORAGE_TOKEN)
  const planSlug = readStore(STORAGE_PLAN)
  if (!token || !planSlug) return null
  return { token, planSlug }
}

export function readIntakeAccessEmail(): string {
  return readStore(STORAGE_EMAIL) ?? ''
}

export function clearIntakeAccessSession(): void {
  clearStore(STORAGE_TOKEN)
  clearStore(STORAGE_PLAN)
}

/** Solo `npm run dev`. El build de producción sigue exigiendo el OK de Tomás. */
export function isDevIntakeAccessBypass(): boolean {
  return import.meta.env.DEV
}

function intakeFunctionUrl(): string | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!supabaseUrl?.trim()) return null
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/web-intake-access`
}

async function postIntakeAccess(body: Record<string, unknown>): Promise<Response> {
  const url = intakeFunctionUrl()
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  if (!url || !anon) throw new Error('Falta configuración del sitio')
  const secret =
    typeof import.meta.env.VITE_PUBLIC_INTAKE_SECRET === 'string'
      ? import.meta.env.VITE_PUBLIC_INTAKE_SECRET.trim()
      : ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  }
  if (secret) headers['x-intake-secret'] = secret
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
}

export async function requestWebIntakeAccess(params: {
  planSlug: string
  planTitle: string
  applicantName?: string
  applicantEmail?: string
  applicantPhone?: string
}): Promise<{ ok: true; requestToken: string } | { ok: false; error: string }> {
  try {
    const res = await postIntakeAccess({
      action: 'request',
      plan_slug: params.planSlug,
      plan_title: params.planTitle,
      applicant_name: params.applicantName?.trim() || undefined,
      applicant_email: params.applicantEmail?.trim() || undefined,
      applicant_phone: params.applicantPhone?.trim() || undefined,
    })
    const raw = await res.text()
    let data: { ok?: boolean; error?: string; request_token?: string }
    try {
      data = JSON.parse(raw) as typeof data
    } catch {
      return { ok: false, error: `Respuesta inválida (${res.status})` }
    }
    if (!res.ok || !data.ok || !data.request_token) {
      return { ok: false, error: data.error ?? 'No se pudo registrar la solicitud' }
    }
    saveIntakeAccessSession(data.request_token, params.planSlug, params.applicantEmail)
    return { ok: true, requestToken: data.request_token }
  } catch {
    return { ok: false, error: 'Error de conexión. Probá de nuevo.' }
  }
}

export async function checkWebIntakeAccessStatus(
  requestToken: string,
): Promise<{ ok: true; status: WebIntakeAccessStatus } | { ok: false; error: string }> {
  try {
    const res = await postIntakeAccess({ action: 'status', request_token: requestToken })
    const raw = await res.text()
    let data: { ok?: boolean; error?: string; status?: WebIntakeAccessStatus }
    try {
      data = JSON.parse(raw) as typeof data
    } catch {
      return { ok: false, error: `Respuesta inválida (${res.status})` }
    }
    if (!res.ok || !data.ok || !data.status) {
      return { ok: false, error: data.error ?? 'No se pudo consultar el estado' }
    }
    return { ok: true, status: data.status }
  } catch {
    return { ok: false, error: 'Error de conexión' }
  }
}

/**
 * Solo `npm run dev`. Crea un token aprobado con la sesión de staff
 * para que el envío de /form no falle con 401.
 */
export async function issueDevApprovedIntakeAccess(params: {
  planSlug: string
  planTitle: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!import.meta.env.DEV) {
    return { ok: false, error: 'Solo disponible en desarrollo' }
  }

  const { data, error } = await supabase.rpc('issue_staff_intake_access_token', {
    p_plan_slug: params.planSlug,
    p_plan_title: params.planTitle,
  })

  if (error) {
    const m = error.message.toLowerCase()
    if (m.includes('does not exist') || m.includes('schema cache') || m.includes('42883')) {
      return {
        ok: false,
        error:
          'Falta aplicar en el SQL Editor de Supabase el archivo 20260825170000_issue_staff_intake_access_token.sql',
      }
    }
    if (m.includes('jwt') || m.includes('not authenticated') || m.includes('unauthorized')) {
      return {
        ok: false,
        error: 'Iniciá sesión en /login como entrenador, recargá /form y volvé a tocar Saltar permiso.',
      }
    }
    return { ok: false, error: error.message }
  }

  const row = data as { ok?: boolean; error?: string; request_token?: string } | null
  if (row?.error === 'not_authenticated') {
    return {
      ok: false,
      error: 'Iniciá sesión en /login como entrenador, recargá /form y volvé a tocar Saltar permiso.',
    }
  }
  if (row?.error === 'not_staff') {
    return {
      ok: false,
      error: 'Tu usuario no es staff. Entrá con una cuenta de entrenador para saltar el permiso.',
    }
  }
  if (row?.error === 'rate_limited') {
    return { ok: false, error: 'Demasiados permisos de prueba. Esperá un rato.' }
  }
  if (!row?.ok || !row.request_token) {
    return { ok: false, error: 'No se pudo generar el permiso de desarrollo.' }
  }

  saveIntakeAccessSession(String(row.request_token), params.planSlug)
  return { ok: true }
}

/** Retoma un permiso ya pedido (mail + plan), aunque se haya cerrado la pestaña. */
export async function resumeWebIntakeAccessByEmail(params: {
  email: string
  planSlug: string
}): Promise<
  | { ok: true; requestToken: string; status: WebIntakeAccessStatus }
  | { ok: false; error: string }
> {
  const email = params.email.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Ingresá un mail válido' }
  }
  try {
    const { data, error } = await supabase.rpc('resume_web_intake_access', {
      p_email: email,
      p_plan_slug: params.planSlug,
    })
    if (error) {
      const m = error.message.toLowerCase()
      if (m.includes('does not exist') || m.includes('schema cache') || m.includes('42883')) {
        return {
          ok: false,
          error: 'Falta aplicar el SQL resume_web_intake_access. Pedile a Tomás que recargue o pedí permiso de nuevo.',
        }
      }
      return { ok: false, error: error.message }
    }
    const row = data as { ok?: boolean; error?: string; request_token?: string; status?: WebIntakeAccessStatus } | null
    if (!row?.ok || !row.request_token || !row.status) {
      return { ok: false, error: 'No hay un permiso para ese mail en este plan. Pedí acceso de nuevo.' }
    }
    saveIntakeAccessSession(String(row.request_token), params.planSlug, email)
    return { ok: true, requestToken: String(row.request_token), status: row.status }
  } catch {
    return { ok: false, error: 'Error de conexión' }
  }
}

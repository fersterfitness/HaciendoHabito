const STORAGE_TOKEN = 'hh_intake_access_token'
const STORAGE_PLAN = 'hh_intake_access_plan'

export type WebIntakeAccessStatus = 'pending' | 'approved' | 'denied'

export function saveIntakeAccessSession(requestToken: string, planSlug: string): void {
  sessionStorage.setItem(STORAGE_TOKEN, requestToken)
  sessionStorage.setItem(STORAGE_PLAN, planSlug)
}

export function readIntakeAccessSession(): { token: string; planSlug: string } | null {
  const token = sessionStorage.getItem(STORAGE_TOKEN)?.trim()
  const planSlug = sessionStorage.getItem(STORAGE_PLAN)?.trim()
  if (!token || !planSlug) return null
  return { token, planSlug }
}

export function clearIntakeAccessSession(): void {
  sessionStorage.removeItem(STORAGE_TOKEN)
  sessionStorage.removeItem(STORAGE_PLAN)
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
    saveIntakeAccessSession(data.request_token, params.planSlug)
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

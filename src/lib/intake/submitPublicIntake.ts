/**
 * Envío compartido al formulario público → Edge Function `public-intake-form`.
 * Mantiene compatibilidad con `VITE_PUBLIC_INTAKE_SECRET` si está definido.
 */
import { devLog } from '@/lib/devLog'

export type PublicIntakeResponseBody = {
  ok?: boolean
  error?: string
  warnings?: string[]
}

export type PublicIntakeSubmitFiles = {
  progress?: File[]
  profile?: File | null
  medical?: File | null
}

export type PublicIntakeSubmitResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; error: string; status?: number }

function getIntakeSecretHeader(): string | undefined {
  const secret =
    typeof import.meta.env.VITE_PUBLIC_INTAKE_SECRET === 'string'
      ? import.meta.env.VITE_PUBLIC_INTAKE_SECRET.trim()
      : ''
  return secret || undefined
}

export function parsePublicIntakeResponseBody(
  res: Response,
  rawText: string,
): PublicIntakeResponseBody | { parseError: true; status: number } {
  try {
    return JSON.parse(rawText) as PublicIntakeResponseBody
  } catch {
    return { parseError: true, status: res.status }
  }
}

export function friendlyPublicIntakeParseError(status: number): string {
  if (status === 413) return 'Los archivos pesan demasiado. Probá fotos más chicas.'
  if (status === 504) {
    return 'El envío tardó demasiado. Probá con fotos más chicas o sin adjuntos para probar.'
  }
  return `El servidor no respondió bien (${status}). Si adjuntaste fotos, probá reducir su tamaño.`
}

/**
 * POST a `public-intake-form` (JSON o multipart con campo `payload`).
 */
export async function submitPublicIntake(
  payload: Record<string, unknown>,
  files?: PublicIntakeSubmitFiles,
): Promise<PublicIntakeSubmitResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  if (!supabaseUrl || !anon) {
    return { ok: false, error: 'Falta configuración del sitio' }
  }

  const endpoint = `${supabaseUrl}/functions/v1/public-intake-form`
  const fnHeaders: Record<string, string> = {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  }
  const intakeSecret = getIntakeSecretHeader()
  if (intakeSecret) fnHeaders['x-intake-secret'] = intakeSecret

  const progress = files?.progress ?? []
  const profile = files?.profile ?? null
  const medical = files?.medical ?? null
  const hasFiles = progress.length > 0 || profile !== null || medical !== null

  let res: Response
  try {
    if (!hasFiles) {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { ...fnHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      const formData = new FormData()
      formData.append('payload', JSON.stringify(payload))
      for (const f of progress) formData.append('progress', f)
      if (profile) formData.append('profile', profile)
      if (medical) formData.append('medical', medical)
      res = await fetch(endpoint, { method: 'POST', headers: fnHeaders, body: formData })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'desconocido'
    devLog.error('[intake] fetch failed', err, { endpoint })
    return { ok: false, error: `No se pudo conectar (${msg}). Si seguís el problema, recargá la página.` }
  }

  const rawText = await res.text()
  if (res.status === 503 && rawText.includes('BOOT_ERROR')) {
    return {
      ok: false,
      error:
        'El formulario no está disponible en el servidor (error de arranque). Volvé a intentar en unos minutos o contactá al estudio.',
      status: 503,
    }
  }

  const body = parsePublicIntakeResponseBody(res, rawText)
  if ('parseError' in body) {
    return { ok: false, error: friendlyPublicIntakeParseError(body.status), status: body.status }
  }

  if (!res.ok || body.error) {
    return { ok: false, error: body.error || 'Error al enviar', status: res.status }
  }
  if (!body.ok) {
    return { ok: false, error: 'No se pudo completar el registro', status: res.status }
  }

  return {
    ok: true,
    warnings: Array.isArray(body.warnings) ? body.warnings : undefined,
  }
}

import { supabase } from '@/lib/supabase'
import { formatFunctionsInvokeError } from '@/lib/invokeFunctionError'
import { createEmptyAnamnesisPayload } from '@/lib/nutrition/anamnesisPayload'

export type AnamnesisPublicLinkStatus = {
  submitted: boolean
  submittedAt: string | null
  linkIssuedAt: string | null
  hasContent: boolean
}

function payloadHasContent(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as Record<string, unknown>
  for (const value of Object.values(p)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      if (value.some((item) => {
        if (item && typeof item === 'object') {
          return Object.values(item as Record<string, unknown>).some((v) => String(v ?? '').trim() !== '')
        }
        return String(item ?? '').trim() !== ''
      })) {
        return true
      }
      continue
    }
    if (String(value).trim() !== '') return true
  }
  return false
}

function publicAppOrigin(): string | undefined {
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '')
  return undefined
}

const ERROR_MESSAGES: Record<string, string> = {
  anamnesis_ya_recibida: 'Este paciente ya envió la anamnesis. El link ya no está disponible.',
  alumno_no_encontrado: 'No tenés acceso a este paciente.',
  sin_permiso: 'Solo nutricionistas o administradores pueden generar este link.',
  configuracion_incompleta: 'Falta configuración en el servidor. Contactá soporte técnico.',
  no_autenticado: 'Sesión vencida: cerrá sesión y volvé a entrar.',
  no_guardado: 'No se pudo guardar el registro del link.',
}

function mapApiError(body: { error?: string; message?: string }, status: number): string {
  if (body.message) return body.message
  if (body.error && ERROR_MESSAGES[body.error]) return ERROR_MESSAGES[body.error]
  if (body.error) return body.error
  if (status === 404) return 'El servicio de links no está publicado. Probá de nuevo en unos minutos.'
  return 'No se pudo generar el link.'
}

function shouldNotRetry(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('ya envió') ||
    msg.includes('ya recibida') ||
    msg.includes('no está disponible') ||
    msg.includes('Solo nutricionistas') ||
    msg.includes('iniciar sesión') ||
    msg.includes('No tenés acceso')
  )
}

export async function fetchAnamnesisPublicLinkStatus(
  studentId: string,
  ownerId: string,
): Promise<AnamnesisPublicLinkStatus> {
  const { data, error } = await supabase
    .from('nutrition_anamnesis')
    .select('public_submitted_at, public_link_issued_at, payload')
    .eq('student_id', studentId)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  const row = data as {
    public_submitted_at?: string | null
    public_link_issued_at?: string | null
    payload?: unknown
  } | null

  return {
    submitted: Boolean(row?.public_submitted_at),
    submittedAt: row?.public_submitted_at ?? null,
    linkIssuedAt: row?.public_link_issued_at ?? null,
    hasContent: payloadHasContent(row?.payload),
  }
}

/** Borra respuestas y habilita un nuevo link público para el paciente. */
export async function resetAnamnesisForRedo(studentId: string, ownerId: string): Promise<void> {
  const { error } = await supabase.from('nutrition_anamnesis').upsert(
    {
      owner_id: ownerId,
      student_id: studentId,
      payload: structuredClone(createEmptyAnamnesisPayload()) as object,
      schema_version: 1,
      public_submitted_at: null,
      public_link_issued_at: null,
    },
    { onConflict: 'owner_id,student_id' },
  )

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('public_submitted_at') || msg.includes('public_link_issued_at')) {
      throw new Error('Falta aplicar la migración de anamnesis en Supabase (db push).')
    }
    throw new Error(msg)
  }
}

async function createViaEdgeFunction(studentId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-anamnesis-link', {
    body: {
      studentId,
      appOrigin: publicAppOrigin(),
    },
  })

  if (error) {
    throw new Error(await formatFunctionsInvokeError(error))
  }

  const payload = data as { ok?: boolean; url?: string; error?: string; message?: string }
  if (!payload?.url) {
    throw new Error(mapApiError(payload ?? {}, 500))
  }
  return payload.url
}

async function createViaVercelApi(studentId: string, token: string): Promise<string> {
  const res = await fetch('/api/anamnesis-link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      studentId,
      appOrigin: publicAppOrigin(),
    }),
  })

  const raw = await res.text().catch(() => '')
  let body: { ok?: boolean; url?: string; error?: string; message?: string } = {}
  try {
    body = raw ? (JSON.parse(raw) as typeof body) : {}
  } catch {
    if (!res.ok) {
      throw new Error(mapApiError({}, res.status))
    }
  }

  if (!res.ok || !body.url) {
    throw new Error(mapApiError(body, res.status))
  }

  return body.url
}

/** Respaldo: guarda emisión con RLS y vuelve a pedir la URL firmada. */
async function createViaClientAndEdgeSign(studentId: string, ownerId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('nutrition_anamnesis')
    .select('public_submitted_at')
    .eq('owner_id', ownerId)
    .eq('student_id', studentId)
    .maybeSingle()

  if ((existing as { public_submitted_at?: string | null } | null)?.public_submitted_at) {
    throw new Error(ERROR_MESSAGES.anamnesis_ya_recibida)
  }

  const issuedAt = new Date().toISOString()
  const { error: saveErr } = await supabase.from('nutrition_anamnesis').upsert(
    {
      owner_id: ownerId,
      student_id: studentId,
      payload: {},
      schema_version: 1,
      public_link_issued_at: issuedAt,
    },
    { onConflict: 'owner_id,student_id' },
  )
  if (saveErr) {
    const msg = saveErr.message ?? ''
    if (msg.includes('public_link_issued_at') || msg.includes('column')) {
      throw new Error('Falta aplicar la migración de anamnesis en Supabase (db push).')
    }
    throw new Error(msg)
  }

  const url = await createViaEdgeFunction(studentId)
  return url
}

export async function createAnamnesisPublicLink(studentId: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const ownerId = sessionData.session?.user?.id
  if (!token || !ownerId) throw new Error('Tenés que iniciar sesión de nuevo.')

  const attempts: Array<() => Promise<string>> = [
    () => createViaEdgeFunction(studentId),
    () => createViaVercelApi(studentId, token),
    () => createViaClientAndEdgeSign(studentId, ownerId),
  ]

  let lastError: Error | null = null
  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      lastError = err
      if (shouldNotRetry(err)) throw err
    }
  }

  throw lastError ?? new Error('No se pudo generar el link.')
}

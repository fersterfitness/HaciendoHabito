/**
 * Genera link personalizado de anamnesis (?student=&token=) para un paciente.
 * Requiere sesión de nutricionista/admin con acceso al alumno.
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
}

function signStudentToken(studentId: string, secret: string): string {
  return createHmac('sha256', secret).update(studentId).digest('hex').slice(0, 32)
}

function appOrigin(req: Request, fromBody?: string): string {
  const trimmed = (fromBody ?? '').trim().replace(/\/$/, '')
  if (trimmed && /^https?:\/\//i.test(trimmed)) return trimmed
  const fromEnv = process.env.VITE_APP_URL ?? process.env.VERCEL_URL
  if (fromEnv) {
    const base = fromEnv.startsWith('http') ? fromEnv : `https://${fromEnv}`
    return base.replace(/\/$/, '')
  }
  const origin = req.headers.get('origin')
  if (origin && origin !== 'null') return origin.replace(/\/$/, '')
  const ref = req.headers.get('referer')
  if (ref) {
    try {
      return new URL(ref).origin
    } catch {
      /* ignore */
    }
  }
  return 'http://localhost:5173'
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const linkSecret = (process.env.ANAMNESIS_LINK_SECRET ?? process.env.INTAKE_SECRET ?? '').trim()

  if (!supabaseUrl || !anon) {
    return Response.json(
      { error: 'configuracion_incompleta', message: 'Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en Vercel.' },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'no_autenticado' }, { status: 401 })
  }

  let body: { studentId?: string; appOrigin?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'json_invalido' }, { status: 400 })
  }

  const studentId = (body.studentId ?? '').trim()
  if (!studentId) {
    return Response.json({ error: 'student_id_requerido' }, { status: 400 })
  }

  const authed = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: authErr } = await authed.auth.getUser()
  const uid = userData.user?.id
  if (authErr || !uid) {
    return Response.json({ error: 'no_autenticado' }, { status: 401 })
  }

  const { data: profile } = await authed.from('profiles').select('role').eq('id', uid).maybeSingle()
  const role = (profile as { role?: string } | null)?.role
  if (role !== 'nutritionist' && role !== 'admin') {
    return Response.json({ error: 'sin_permiso' }, { status: 403 })
  }

  const { data: studentRpc, error: studentErr } = await authed.rpc('get_my_student', {
    p_student_id: studentId,
  })
  const student = Array.isArray(studentRpc) ? studentRpc[0] : studentRpc

  if (studentErr) {
    return Response.json(
      { error: 'alumno_error', message: studentErr.message },
      { status: 500 },
    )
  }
  if (!student) {
    return Response.json(
      {
        error: 'alumno_no_encontrado',
        message: 'No tenés acceso a este paciente o no existe.',
      },
      { status: 404 },
    )
  }

  const ownerId = uid

  const { data: existing, error: existingErr } = await authed
    .from('nutrition_anamnesis')
    .select('id, public_submitted_at')
    .eq('owner_id', ownerId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (existingErr) {
    const msg = existingErr.message ?? ''
    const missingCols =
      msg.includes('public_link_issued_at') ||
      msg.includes('public_submitted_at') ||
      msg.includes('column')
    return Response.json(
      {
        error: 'no_guardado',
        message: missingCols
          ? 'Falta aplicar la migración de anamnesis en Supabase (db push).'
          : msg,
      },
      { status: 500 },
    )
  }

  if ((existing as { public_submitted_at?: string | null } | null)?.public_submitted_at) {
    return Response.json(
      {
        error: 'anamnesis_ya_recibida',
        message: 'Este paciente ya envió la anamnesis. El link ya no está disponible.',
      },
      { status: 409 },
    )
  }

  const issuedAt = new Date().toISOString()

  const { error: saveErr } = await authed.from('nutrition_anamnesis').upsert(
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
    return Response.json({ error: 'no_guardado', message: saveErr.message }, { status: 500 })
  }

  const token = linkSecret ? signStudentToken(studentId, linkSecret) : ''
  const qs = new URLSearchParams({ student: studentId })
  if (token) qs.set('token', token)
  const url = `${appOrigin(request, body.appOrigin)}/forms/anamnesis-nutricional.html?${qs.toString()}`

  return Response.json({
    ok: true,
    url,
    issuedAt,
    requiresToken: Boolean(linkSecret),
  })
}

/**
 * Comprueba si el paciente puede usar el formulario público (link válido y no enviado aún).
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
}

function signStudentToken(studentId: string, secret: string): string {
  return createHmac('sha256', secret).update(studentId).digest('hex').slice(0, 32)
}

function tokenOk(studentId: string, token: string, secret: string): boolean {
  if (!secret) return true
  if (!token) return false
  const expected = signStudentToken(studentId, secret)
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}

async function resolveNutritionOwnerId(
  admin: ReturnType<typeof createClient>,
  intakeNutritionOwnerId: string,
): Promise<string | null> {
  if (intakeNutritionOwnerId) return intakeNutritionOwnerId
  const { data } = await admin
    .from('profiles')
    .select('id, role')
    .in('role', ['nutritionist', 'admin'])
    .limit(10)
  if (!data?.length) return null
  const rows = data as { id: string; role: string }[]
  return rows.find((p) => p.role === 'nutritionist')?.id ?? rows.find((p) => p.role === 'admin')?.id ?? null
}

async function nutritionOwnerForStudent(
  admin: ReturnType<typeof createClient>,
  studentId: string,
  intakeNutritionOwnerId: string,
): Promise<string | null> {
  const { data: links } = await admin
    .from('student_owners')
    .select('owner_id, professional_type')
    .eq('student_id', studentId)
  const fromOwners = (links as { owner_id: string; professional_type: string }[] | null)?.find(
    (r) => r.professional_type === 'nutritionist',
  )?.owner_id
  if (fromOwners) return fromOwners

  const { data: student } = await admin
    .from('students')
    .select('owner_id')
    .eq('id', studentId)
    .maybeSingle()
  const ownerId = (student as { owner_id?: string } | null)?.owner_id
  if (!ownerId) return resolveNutritionOwnerId(admin, intakeNutritionOwnerId)

  const { data: profile } = await admin.from('profiles').select('role').eq('id', ownerId).maybeSingle()
  if ((profile as { role?: string } | null)?.role === 'nutritionist') return ownerId
  return resolveNutritionOwnerId(admin, intakeNutritionOwnerId)
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const studentId = (url.searchParams.get('student') ?? '').trim()
  const token = (url.searchParams.get('token') ?? '').trim()

  const linkSecret = (process.env.ANAMNESIS_LINK_SECRET ?? process.env.INTAKE_SECRET ?? '').trim()
  const requireToken = linkSecret.length > 0

  if (!studentId) {
    return Response.json({
      accessible: false,
      reason: 'link_requerido',
      message:
        'Este formulario solo se abre con el link personalizado que te envía tu nutricionista desde la app.',
    })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return Response.json({
      accessible: false,
      reason: 'configuracion_incompleta',
      message: 'No pudimos verificar tu enlace. Tu nutricionista debe contactar soporte técnico.',
    })
  }

  if (requireToken && !token) {
    return Response.json({
      accessible: false,
      reason: 'token_requerido',
      message:
        'El link está incompleto. Pedile a tu nutricionista que te reenvíe el enlace desde Historia → Copiar link de anamnesis.',
    })
  }

  if (!tokenOk(studentId, token, linkSecret)) {
    return Response.json({
      accessible: false,
      reason: 'token_invalido',
      message:
        'Este enlace no es válido o ya no sirve. Pedile a tu nutricionista un link nuevo desde la app.',
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const intakeOwner = process.env.INTAKE_NUTRITION_OWNER_ID ?? ''

  const { data: student } = await admin
    .from('students')
    .select('id')
    .eq('id', studentId)
    .maybeSingle()

  if (!student) {
    return Response.json({
      accessible: false,
      reason: 'alumno_no_encontrado',
      message: 'No encontramos tu ficha. Pedile a tu nutricionista un link nuevo.',
    })
  }

  const ownerId = await nutritionOwnerForStudent(admin, studentId, intakeOwner)
  if (!ownerId) {
    return Response.json({
      accessible: false,
      reason: 'sin_nutricionista',
      message: 'No pudimos asignar tu formulario a un nutricionista. Avisale a tu profesional.',
    })
  }

  const { data, error } = await admin
    .from('nutrition_anamnesis')
    .select('public_submitted_at, public_link_issued_at')
    .eq('owner_id', ownerId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) {
    const schemaPending =
      error.message.includes('public_submitted_at') ||
      error.message.includes('public_link_issued_at')
    return Response.json({
      accessible: false,
      reason: 'configuracion_incompleta',
      message: schemaPending
        ? 'El formulario aún no está habilitado en el servidor. Tu nutricionista debe avisar al equipo técnico.'
        : 'No pudimos verificar tu enlace. Probá más tarde o pedile otro link a tu nutricionista.',
    })
  }

  const row = data as {
    public_submitted_at?: string | null
    public_link_issued_at?: string | null
  } | null

  if (row?.public_submitted_at) {
    return Response.json({
      accessible: false,
      submitted: true,
      reason: 'already_submitted',
      submittedAt: row.public_submitted_at,
      message:
        'Ya enviaste tu anamnesis con este enlace. Si necesitás cambiar algo, escribile a tu nutricionista.',
    })
  }

  return Response.json({
    accessible: true,
    submitted: false,
    reason: 'ok',
    linkIssuedAt: row?.public_link_issued_at ?? null,
  })
}

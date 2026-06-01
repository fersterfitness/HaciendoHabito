import { supabase } from '@/lib/supabase'
import type {
  PlanAssignmentPaymentStatus,
  PlanBillingPeriod,
  PlanPaymentMethod,
  StudentPlanAssignment,
} from '@/types/database'

export const BILLING_PERIOD_LABELS: Record<PlanBillingPeriod, string> = {
  monthly: 'Mensual',
  months3: 'Trimestral (3 meses)',
  months6: 'Semestral (6 meses)',
  annual: 'Anual',
}

export const BILLING_PERIOD_MONTHS: Record<PlanBillingPeriod, number> = {
  monthly: 1,
  months3: 3,
  months6: 6,
  annual: 12,
}

export const PAYMENT_STATUS_LABELS: Record<PlanAssignmentPaymentStatus, string> = {
  pending: 'Pendiente de pago',
  paid: 'Pagado',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
}

export const PAYMENT_METHOD_LABELS: Record<PlanPaymentMethod, string> = {
  cash: 'Efectivo',
  mercadopago: 'Mercado Pago',
  transfer: 'Transferencia',
  other: 'Otro',
}

export function addMonthsToISODate(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCMonth(date.getUTCMonth() + months)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime()
  const to = new Date(`${toISO}T00:00:00Z`).getTime()
  return Math.round((to - from) / (1000 * 60 * 60 * 24))
}

export function isAssignmentActive(a: Pick<StudentPlanAssignment, 'start_date' | 'end_date' | 'payment_status'>): boolean {
  if (a.payment_status === 'cancelled') return false
  const t = todayISO()
  return a.start_date <= t && t <= a.end_date
}

/**
 * Estado de pago efectivo: si la fecha de vencimiento pasó y sigue 'pending', se considera 'overdue'.
 * Si ya está 'paid' o 'cancelled' se respeta tal cual.
 */
export function effectivePaymentStatus(a: StudentPlanAssignment): PlanAssignmentPaymentStatus {
  if (a.payment_status === 'pending' && a.end_date < todayISO()) return 'overdue'
  return a.payment_status
}

export async function fetchAssignmentsForStudent(studentId: string): Promise<StudentPlanAssignment[]> {
  const { data, error } = await supabase
    .from('student_plan_assignments')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[fetchAssignmentsForStudent]', error)
    return []
  }
  return (data ?? []) as StudentPlanAssignment[]
}

/** El plan vigente es el que cubre hoy y no está cancelado; si no hay, el último no cancelado. */
export function pickCurrentAssignment(list: StudentPlanAssignment[]): StudentPlanAssignment | null {
  if (list.length === 0) return null
  const active = list.find(isAssignmentActive)
  if (active) return active
  const notCancelled = list.find((a) => a.payment_status !== 'cancelled')
  return notCancelled ?? list[0]
}

export async function createAssignment(args: {
  studentId: string
  webPlanSlug: string | null
  planNameSnapshot: string
  billingPeriod: PlanBillingPeriod
  startDate: string
  paymentStatus?: PlanAssignmentPaymentStatus
  paymentMethod?: PlanPaymentMethod | null
  amount?: number | null
  notes?: string | null
}): Promise<{ ok: true; assignment: StudentPlanAssignment } | { ok: false; error: string }> {
  const endDate = addMonthsToISODate(args.startDate, BILLING_PERIOD_MONTHS[args.billingPeriod])
  const { data: userData } = await supabase.auth.getUser()
  const assignedBy = userData?.user?.id ?? null

  const { data, error } = await supabase
    .from('student_plan_assignments')
    .insert({
      student_id: args.studentId,
      web_plan_slug: args.webPlanSlug,
      plan_name_snapshot: args.planNameSnapshot,
      billing_period: args.billingPeriod,
      start_date: args.startDate,
      end_date: endDate,
      payment_status: args.paymentStatus ?? 'pending',
      payment_method: args.paymentMethod ?? null,
      amount: args.amount ?? null,
      assigned_by: assignedBy,
      notes: args.notes ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'No se pudo crear la asignación' }
  }

  await supabase.from('students').update({ plan_end_date: endDate }).eq('id', args.studentId)

  return { ok: true, assignment: data as StudentPlanAssignment }
}

export async function updateAssignment(
  assignmentId: string,
  patch: Partial<{
    web_plan_slug: string | null
    plan_name_snapshot: string
    billing_period: PlanBillingPeriod
    start_date: string
    end_date: string
    payment_status: PlanAssignmentPaymentStatus
    payment_method: PlanPaymentMethod | null
    amount: number | null
    notes: string | null
  }>,
): Promise<{ ok: true; assignment: StudentPlanAssignment } | { ok: false; error: string }> {
  // Si cambia start_date o billing pero no end_date, recalculamos end_date.
  const finalPatch: Record<string, unknown> = { ...patch }
  if (patch.start_date && patch.billing_period && !patch.end_date) {
    finalPatch.end_date = addMonthsToISODate(patch.start_date, BILLING_PERIOD_MONTHS[patch.billing_period])
  }

  const { data, error } = await supabase
    .from('student_plan_assignments')
    .update(finalPatch)
    .eq('id', assignmentId)
    .select('*')
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'No se pudo actualizar' }
  return { ok: true, assignment: data as StudentPlanAssignment }
}

export async function deleteAssignment(assignmentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('student_plan_assignments').delete().eq('id', assignmentId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function cancelAssignment(assignmentId: string, reason?: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('student_plan_assignments')
    .update({ payment_status: 'cancelled', notes: reason ?? null })
    .eq('id', assignmentId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function updateAssignmentPaymentStatus(
  assignmentId: string,
  paymentStatus: PlanAssignmentPaymentStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('student_plan_assignments')
    .update({ payment_status: paymentStatus })
    .eq('id', assignmentId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Trae las asignaciones cuyo end_date está entre hoy y hoy+daysAhead, no canceladas/pagadas.
 * Útil para el dashboard ("planes por vencer").
 */
export async function fetchAssignmentsExpiringSoon(daysAhead = 14): Promise<Array<StudentPlanAssignment & { student_name?: string }>> {
  const today = todayISO()
  const limit = addMonthsToISODate(today, 0) // start with today
  // Add daysAhead days
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + daysAhead)
  const futureISO = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('student_plan_assignments')
    .select('*, students!inner(full_name)')
    .gte('end_date', limit)
    .lte('end_date', futureISO)
    .neq('payment_status', 'cancelled')
    .order('end_date', { ascending: true })

  if (error) {
    console.error('[fetchAssignmentsExpiringSoon]', error)
    return []
  }
  return (data ?? []).map((row: StudentPlanAssignment & { students?: { full_name?: string } }) => ({
    ...row,
    student_name: row.students?.full_name,
  })) as Array<StudentPlanAssignment & { student_name?: string }>
}

/**
 * Trae la asignación vigente de una lista de alumnos. Devuelve un map por studentId.
 */
export async function fetchCurrentAssignmentsForStudents(studentIds: string[]): Promise<Record<string, StudentPlanAssignment>> {
  if (studentIds.length === 0) return {}
  const { data, error } = await supabase
    .from('student_plan_assignments')
    .select('*')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchCurrentAssignmentsForStudents]', error)
    return {}
  }

  const grouped: Record<string, StudentPlanAssignment[]> = {}
  for (const row of (data ?? []) as StudentPlanAssignment[]) {
    if (!grouped[row.student_id]) grouped[row.student_id] = []
    grouped[row.student_id].push(row)
  }
  const result: Record<string, StudentPlanAssignment> = {}
  for (const [sid, list] of Object.entries(grouped)) {
    const current = pickCurrentAssignment(list)
    if (current) result[sid] = current
  }
  return result
}

import { supabase } from '@/lib/supabase'
import type {
  PlanAssignmentPaymentStatus,
  PlanBillingPeriod,
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

export function isAssignmentActive(a: Pick<StudentPlanAssignment, 'start_date' | 'end_date'>): boolean {
  const t = todayISO()
  return a.start_date <= t && t <= a.end_date
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

/** El plan vigente es el que cubre hoy; si no hay, el último creado. */
export function pickCurrentAssignment(list: StudentPlanAssignment[]): StudentPlanAssignment | null {
  if (list.length === 0) return null
  const active = list.find(isAssignmentActive)
  return active ?? list[0]
}

export async function createAssignment(args: {
  studentId: string
  webPlanSlug: string | null
  planNameSnapshot: string
  billingPeriod: PlanBillingPeriod
  startDate: string
  paymentStatus?: PlanAssignmentPaymentStatus
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
      assigned_by: assignedBy,
      notes: args.notes ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'No se pudo crear la asignación' }
  }

  // Sincronizar plan_end_date en students para compatibilidad con UI existente.
  await supabase.from('students').update({ plan_end_date: endDate }).eq('id', args.studentId)

  return { ok: true, assignment: data as StudentPlanAssignment }
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

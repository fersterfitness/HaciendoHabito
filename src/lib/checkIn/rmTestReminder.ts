import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { loadWeeklyCheckInsByOwner } from '@/lib/checkIn/routineWeekProgress'
import { parseQuestions, weekStatusFromAnswers, weekStatusHasSignal } from '@/lib/checkIn/questions'
import type { Json } from '@/types/database'

/** Cada cuántas semanas de rutina (sumando rutinas) toca volver a testear el RM. */
export const RM_TEST_EVERY_WEEKS = 12

export const RM_TEST_SQL_HINT =
  'Falta un cambio en la base: students.rm_test_reset_at. Corré el SQL 20261012121000_students_rm_test_reset.'

/**
 * Semanas entrenadas después de `since`: una por semana calendario con check-in semanal
 * (si el alumno manda dos formularios la misma semana, cuenta una).
 */
export function countTrainingWeeks(submittedAts: string[], since: string | null): number {
  const from = since ? new Date(since).getTime() : -Infinity
  const weeks = new Set<string>()
  for (const at of submittedAts) {
    const d = new Date(at)
    if (d.getTime() > from) weeks.add(format(d, "RRRR-'W'II"))
  }
  return weeks.size
}

/**
 * Desde cuándo se cuenta: lo más reciente entre «marcado como leído» y el último RM cargado.
 * Cargar un test nuevo reinicia la cuenta igual que marcar el aviso.
 */
export function rmTestBaseline(resetAt: string | null | undefined, lastTestedAt: string | null | undefined): string | null {
  const candidates = [resetAt ?? null, lastTestedAt ? `${lastTestedAt.slice(0, 10)}T23:59:59` : null].filter(
    (x): x is string => !!x,
  )
  if (!candidates.length) return null
  return candidates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
}

/** Últimos 2 años: alcanza de sobra para contar 12 semanas sin traer todo el historial. */
function lookbackIso(): string {
  return new Date(Date.now() - 730 * 86_400_000).toISOString()
}

export type RmTestWeeksRow = { id: string; full_name: string; phone: string | null; weeks: number }

/** Semanas desde el último test de RM, por alumno activo del dueño. */
export async function loadRmTestWeeksByOwner(ownerId: string): Promise<RmTestWeeksRow[]> {
  const [stuRes, rmRes, checkIns] = await Promise.all([
    // `*` para no romper si todavía no se corrió la migración de rm_test_reset_at.
    supabase.from('students').select('*').eq('owner_id', ownerId).eq('status', 'activo'),
    supabase.from('student_rm_records').select('student_id, tested_at').eq('owner_id', ownerId),
    loadWeeklyCheckInsByOwner(ownerId, lookbackIso()),
  ])
  const lastTest = new Map<string, string>()
  for (const r of (rmRes.data ?? []) as { student_id: string; tested_at: string }[]) {
    const prev = lastTest.get(r.student_id)
    if (!prev || r.tested_at > prev) lastTest.set(r.student_id, r.tested_at)
  }
  const atsByStudent = new Map<string, string[]>()
  for (const c of checkIns) {
    if (!atsByStudent.has(c.studentId)) atsByStudent.set(c.studentId, [])
    atsByStudent.get(c.studentId)!.push(c.submittedAt)
  }
  type Stu = { id: string; full_name: string; phone: string | null; rm_test_reset_at?: string | null }
  return ((stuRes.data ?? []) as Stu[]).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    phone: s.phone ?? null,
    weeks: countTrainingWeeks(atsByStudent.get(s.id) ?? [], rmTestBaseline(s.rm_test_reset_at, lastTest.get(s.id))),
  }))
}

/** Marca el aviso como leído: la cuenta de 12 semanas vuelve a cero. */
export async function markRmTestReminderRead(studentId: string): Promise<string | null> {
  const { error } = await supabase
    .from('students')
    .update({ rm_test_reset_at: new Date().toISOString() })
    .eq('id', studentId)
  if (!error) return null
  return error.code === '42703' || /rm_test_reset_at/.test(error.message) ? RM_TEST_SQL_HINT : error.message
}

/** Semanas desde el último test de RM de un alumno (ficha). */
export async function loadRmTestWeeksForStudent(
  studentId: string,
  resetAt: string | null | undefined,
  lastTestedAt: string | null | undefined,
): Promise<number> {
  const since = rmTestBaseline(resetAt, lastTestedAt)
  const { data: invites } = await supabase
    .from('check_in_invites')
    .select('id, form:check_in_forms(questions)')
    .eq('student_id', studentId)
  const list = (invites ?? []) as { id: string; form: { questions: Json } | { questions: Json }[] | null }[]
  if (!list.length) return 0
  const questionsByInvite = new Map(
    list.map((i) => [i.id, parseQuestions((Array.isArray(i.form) ? i.form[0] : i.form)?.questions)]),
  )
  let q = supabase
    .from('check_in_responses')
    .select('invite_id, submitted_at, responses')
    .in(
      'invite_id',
      list.map((i) => i.id),
    )
    .order('submitted_at', { ascending: false })
  if (since) q = q.gt('submitted_at', new Date(since).toISOString())
  const { data: resp } = await q
  const ats: string[] = []
  for (const r of (resp ?? []) as { invite_id: string; submitted_at: string; responses: Json }[]) {
    const obj =
      r.responses && typeof r.responses === 'object' && !Array.isArray(r.responses)
        ? (r.responses as Record<string, unknown>)
        : {}
    if (weekStatusHasSignal(weekStatusFromAnswers(questionsByInvite.get(r.invite_id) ?? [], obj))) ats.push(r.submitted_at)
  }
  return countTrainingWeeks(ats, since)
}

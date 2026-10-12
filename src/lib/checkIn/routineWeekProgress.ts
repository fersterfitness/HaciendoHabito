import { supabase } from '@/lib/supabase'
import { parseQuestions, weekStatusFromAnswers, weekStatusHasSignal } from '@/lib/checkIn/questions'
import type { Json } from '@/types/database'
import type { LatestWeekStatus } from '@/lib/checkIn/latestWeekStatus'

const EMPTY: LatestWeekStatus = { finished: false, weekNumber: null, lastWeek: false, submittedAt: null }

export type RoutineWeekRow = LatestWeekStatus & {
  totalWeeks: number
}

/**
 * Alta de la rutina vigente por alumno. Los check-ins anteriores pertenecen a la rutina
 * previa: con una rutina nueva los cuadraditos arrancan vacíos hasta el próximo formulario.
 */
async function loadActiveRoutineStartByStudent(ownerId: string): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('routines')
    .select('student_id, created_at')
    .eq('owner_id', ownerId)
    .in('status', ['activa', 'por_vencer'])
    .not('student_id', 'is', null)
    .order('created_at', { ascending: false })
  const out = new Map<string, string>()
  for (const row of (data ?? []) as { student_id: string; created_at: string }[]) {
    if (!out.has(row.student_id)) out.set(row.student_id, row.created_at)
  }
  return out
}

export type WeeklyCheckIn = {
  studentId: string
  submittedAt: string
  finished: boolean
  weekNumber: number | null
  lastWeek: boolean
}

const PAGE = 1000

/**
 * Check-ins semanales con dato de semana (ignora feedback mensual), del más nuevo al más viejo.
 * `since`: solo respuestas desde esa fecha (ISO).
 */
export async function loadWeeklyCheckInsByOwner(ownerId: string, since?: string): Promise<WeeklyCheckIn[]> {
  const { data: forms } = await supabase.from('check_in_forms').select('id, questions').eq('owner_id', ownerId)
  const formList = (forms ?? []) as { id: string; questions: Json }[]
  if (!formList.length) return []

  const questionsByForm = new Map(formList.map((f) => [f.id, parseQuestions(f.questions)]))
  const { data: inviteRows } = await supabase
    .from('check_in_invites')
    .select('id, form_id, student_id')
    .in(
      'form_id',
      formList.map((f) => f.id),
    )
  const invites = (inviteRows ?? []) as { id: string; form_id: string; student_id: string }[]
  if (!invites.length) return []

  const inviteById = new Map(invites.map((i) => [i.id, i]))
  const respRows: { invite_id: string; submitted_at: string; responses: Json }[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('check_in_responses')
      .select('invite_id, submitted_at, responses')
      .in(
        'invite_id',
        invites.map((i) => i.id),
      )
      .order('submitted_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (since) q = q.gte('submitted_at', since)
    const { data } = await q
    const page = (data ?? []) as typeof respRows
    respRows.push(...page)
    if (page.length < PAGE) break
  }

  const out: WeeklyCheckIn[] = []
  for (const r of respRows) {
    const inv = inviteById.get(r.invite_id)
    if (!inv) continue
    const qs = questionsByForm.get(inv.form_id) ?? []
    const obj =
      r.responses && typeof r.responses === 'object' && !Array.isArray(r.responses)
        ? (r.responses as Record<string, unknown>)
        : {}
    const st = weekStatusFromAnswers(qs, obj)
    if (!weekStatusHasSignal(st)) continue
    out.push({
      studentId: inv.student_id,
      submittedAt: r.submitted_at,
      finished: st.finished,
      weekNumber: st.weekNumber,
      lastWeek: st.lastWeek,
    })
  }
  return out
}

/** Último check-in semanal por alumno (dueño), dentro de la rutina vigente. */
export async function loadWeekStatusByOwner(ownerId: string): Promise<Map<string, LatestWeekStatus>> {
  const [checkIns, routineStartByStudent] = await Promise.all([
    loadWeeklyCheckInsByOwner(ownerId),
    loadActiveRoutineStartByStudent(ownerId),
  ])
  const out = new Map<string, LatestWeekStatus>()
  for (const c of checkIns) {
    if (out.has(c.studentId)) continue
    const routineStart = routineStartByStudent.get(c.studentId)
    if (routineStart && new Date(c.submittedAt) < new Date(routineStart)) continue
    out.set(c.studentId, {
      finished: c.finished,
      weekNumber: c.weekNumber,
      lastWeek: c.lastWeek,
      submittedAt: c.submittedAt,
    })
  }
  return out
}

export async function loadBlockCountsByRoutine(routineIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (!routineIds.length) return counts
  const { data } = await supabase.from('routine_blocks').select('routine_id').in('routine_id', routineIds)
  for (const row of data ?? []) {
    const id = (row as { routine_id: string }).routine_id
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

export function weekStatusOrEmpty(map: Map<string, LatestWeekStatus>, studentId: string): LatestWeekStatus {
  return map.get(studentId) ?? EMPTY
}

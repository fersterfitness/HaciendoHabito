import { supabase } from '@/lib/supabase'
import { parseQuestions, weekStatusFromAnswers, weekStatusHasSignal } from '@/lib/checkIn/questions'
import type { Json } from '@/types/database'
import type { LatestWeekStatus } from '@/lib/checkIn/latestWeekStatus'

const EMPTY: LatestWeekStatus = { finished: false, weekNumber: null, lastWeek: false, submittedAt: null }

export type RoutineWeekRow = LatestWeekStatus & {
  totalWeeks: number
}

/** Último check-in semanal por alumno (dueño). */
export async function loadWeekStatusByOwner(ownerId: string): Promise<Map<string, LatestWeekStatus>> {
  const { data: forms } = await supabase.from('check_in_forms').select('id, questions').eq('owner_id', ownerId)
  const formList = (forms ?? []) as { id: string; questions: Json }[]
  const out = new Map<string, LatestWeekStatus>()
  if (!formList.length) return out

  const questionsByForm = new Map(formList.map((f) => [f.id, parseQuestions(f.questions)]))
  const { data: inviteRows } = await supabase
    .from('check_in_invites')
    .select('id, form_id, student_id')
    .in(
      'form_id',
      formList.map((f) => f.id),
    )
  const invites = (inviteRows ?? []) as { id: string; form_id: string; student_id: string }[]
  if (!invites.length) return out

  const inviteById = new Map(invites.map((i) => [i.id, i]))
  const { data: respRows } = await supabase
    .from('check_in_responses')
    .select('invite_id, submitted_at, responses')
    .in(
      'invite_id',
      invites.map((i) => i.id),
    )
    .order('submitted_at', { ascending: false })

  for (const row of respRows ?? []) {
    const r = row as { invite_id: string; submitted_at: string; responses: Json }
    const inv = inviteById.get(r.invite_id)
    if (!inv || out.has(inv.student_id)) continue
    const qs = questionsByForm.get(inv.form_id) ?? []
    const obj =
      r.responses && typeof r.responses === 'object' && !Array.isArray(r.responses)
        ? (r.responses as Record<string, unknown>)
        : {}
    const st = weekStatusFromAnswers(qs, obj)
    if (!weekStatusHasSignal(st)) continue
    out.set(inv.student_id, {
      finished: st.finished,
      weekNumber: st.weekNumber,
      lastWeek: st.lastWeek,
      submittedAt: r.submitted_at,
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

import { supabase } from '@/lib/supabase'
import { parseQuestions, weekStatusFromAnswers, weekStatusHasSignal } from '@/lib/checkIn/questions'
import type { Json } from '@/types/database'

export type LatestWeekStatus = {
  finished: boolean
  weekNumber: number | null
  lastWeek: boolean
  submittedAt: string | null
}

const EMPTY: LatestWeekStatus = { finished: false, weekNumber: null, lastWeek: false, submittedAt: null }

/** Último check-in semanal del alumno (ignora feedback mensual). */
export async function loadLatestWeekStatusForStudent(studentId: string): Promise<LatestWeekStatus> {
  const { data: invites } = await supabase
    .from('check_in_invites')
    .select('id, form:check_in_forms(questions)')
    .eq('student_id', studentId)
  const list = (invites ?? []) as {
    id: string
    form: { questions: Json } | { questions: Json }[] | null
  }[]
  if (!list.length) return EMPTY

  const questionsByInvite = new Map<string, ReturnType<typeof parseQuestions>>()
  for (const i of list) {
    const form = Array.isArray(i.form) ? i.form[0] : i.form
    questionsByInvite.set(i.id, parseQuestions(form?.questions))
  }

  const { data: resp } = await supabase
    .from('check_in_responses')
    .select('invite_id, submitted_at, responses')
    .in('invite_id', list.map((i) => i.id))
    .order('submitted_at', { ascending: false })
    .limit(40)

  for (const row of resp ?? []) {
    const r = row as { invite_id: string; submitted_at: string; responses: Json }
    const qs = questionsByInvite.get(r.invite_id) ?? []
    const obj =
      r.responses && typeof r.responses === 'object' && !Array.isArray(r.responses)
        ? (r.responses as Record<string, unknown>)
        : {}
    const st = weekStatusFromAnswers(qs, obj)
    if (weekStatusHasSignal(st)) {
      return {
        finished: st.finished,
        weekNumber: st.weekNumber,
        lastWeek: st.lastWeek,
        submittedAt: r.submitted_at,
      }
    }
  }
  return EMPTY
}

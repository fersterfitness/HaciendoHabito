import { supabase } from '@/lib/supabase'
import type { CheckInResponsePoint } from '@/lib/checkIn/habitCharts'
import { parseQuestions } from '@/lib/checkIn/questions'
import type { Json } from '@/types/database'

/** Todas las respuestas de check-in del alumno, con las preguntas de su formulario, de la más vieja a la más nueva. */
export async function loadCheckInPoints(studentId: string): Promise<CheckInResponsePoint[]> {
  const { data: inv } = await supabase
    .from('check_in_invites')
    .select('id, form_id, form:check_in_forms(questions)')
    .eq('student_id', studentId)
  const invites = (inv ?? []) as {
    id: string
    form_id: string
    form: { questions: Json } | { questions: Json }[] | null
  }[]
  const questionsByInvite = new Map<string, ReturnType<typeof parseQuestions>>()
  for (const i of invites) {
    const form = Array.isArray(i.form) ? i.form[0] : i.form
    questionsByInvite.set(i.id, parseQuestions(form?.questions))
  }
  const ids = invites.map((i) => i.id)
  if (!ids.length) return []
  const { data: resp } = await supabase
    .from('check_in_responses')
    .select('invite_id, submitted_at, responses')
    .in('invite_id', ids)
    .order('submitted_at', { ascending: true })
  const out: CheckInResponsePoint[] = []
  for (const r of resp ?? []) {
    const row = r as { invite_id: string; submitted_at: string; responses: Json }
    const obj =
      row.responses && typeof row.responses === 'object' && !Array.isArray(row.responses)
        ? (row.responses as Record<string, unknown>)
        : {}
    out.push({ submittedAt: row.submitted_at, questions: questionsByInvite.get(row.invite_id) ?? [], responses: obj })
  }
  return out
}

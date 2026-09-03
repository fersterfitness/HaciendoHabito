import { supabase } from '@/lib/supabase'
import {
  formatStoredAnswer,
  isMonthlyTemplate,
  parseQuestions,
  type CheckInQuestion,
} from '@/lib/checkIn/questions'
import type { Json } from '@/types/database'

export type RoutineDateRange = {
  id: string
  name: string
  start_date: string
  end_date: string
  student_id?: string
}

export type MonthlyFeedbackRow = {
  id: string
  submittedAt: string
  formTitle: string
  questions: CheckInQuestion[]
  responses: Record<string, unknown>
}

/** Texto para Instagram: Q4 / «lo mejor del mes», o el texto más largo. */
export function monthlyTestimonialQuote(
  questions: CheckInQuestion[],
  responses: Record<string, unknown>,
): string | null {
  const textOf = (q: CheckInQuestion | undefined): string | null => {
    if (!q) return null
    const raw = formatStoredAnswer(q, responses[q.id]).trim()
    if (!raw || raw === '—') return null
    return raw
  }

  const byKey = textOf(questions.find((q) => q.key === 'monthly_highlight'))
  if (byKey) return byKey

  const fourth = questions[3]
  if (fourth?.type === 'text') {
    const t = textOf(fourth)
    if (t) return t
  }

  const texts = questions
    .filter((q) => q.type === 'text' && q.key !== 'full_name')
    .map((q) => textOf(q))
    .filter((t): t is string => Boolean(t))
  if (!texts.length) return null
  return [...texts].sort((a, b) => b.length - a.length)[0] ?? null
}

/**
 * Ata un feedback mensual a la rutina vigente en esa fecha.
 * Si llegó después del fin (renovación), usa la rutina que acaba de terminar.
 */
export function matchRoutineForSubmittedAt<T extends RoutineDateRange>(
  routines: T[],
  submittedAt: string,
): T | null {
  const t = new Date(submittedAt).getTime()
  if (!Number.isFinite(t) || !routines.length) return null

  const covering = routines.filter((r) => {
    const start = new Date(`${r.start_date}T00:00:00`).getTime()
    const end = new Date(`${r.end_date}T23:59:59.999`).getTime()
    return t >= start && t <= end
  })
  if (covering.length) {
    return [...covering].sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null
  }

  const endedBefore = routines.filter((r) => new Date(`${r.end_date}T23:59:59.999`).getTime() <= t)
  if (endedBefore.length) {
    return [...endedBefore].sort((a, b) => b.end_date.localeCompare(a.end_date))[0] ?? null
  }

  const startedBefore = routines.filter((r) => new Date(`${r.start_date}T00:00:00`).getTime() <= t)
  if (!startedBefore.length) return null
  return [...startedBefore].sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null
}

export async function loadMonthlyFeedbackPublicToken(ownerId: string): Promise<string | null> {
  const { data: forms } = await supabase
    .from('check_in_forms')
    .select('questions, public_token')
    .eq('owner_id', ownerId)
  for (const f of forms ?? []) {
    const row = f as { questions: Json; public_token: string | null }
    if (isMonthlyTemplate(parseQuestions(row.questions))) return row.public_token ?? null
  }
  return null
}

export async function loadMonthlyFeedbackRows(
  ownerId: string,
  studentId: string,
): Promise<MonthlyFeedbackRow[]> {
  const { data: forms } = await supabase
    .from('check_in_forms')
    .select('id, title, questions, public_token')
    .eq('owner_id', ownerId)
  const monthlyForms = ((forms ?? []) as { id: string; title: string; questions: Json }[]).filter((f) =>
    isMonthlyTemplate(parseQuestions(f.questions)),
  )
  if (!monthlyForms.length) return []

  const { data: invites } = await supabase
    .from('check_in_invites')
    .select('id, form_id')
    .eq('student_id', studentId)
    .in(
      'form_id',
      monthlyForms.map((f) => f.id),
    )
  const invList = (invites ?? []) as { id: string; form_id: string }[]
  if (!invList.length) return []

  const formById = new Map(monthlyForms.map((f) => [f.id, f]))
  const { data: resp } = await supabase
    .from('check_in_responses')
    .select('id, invite_id, submitted_at, responses')
    .in(
      'invite_id',
      invList.map((i) => i.id),
    )
    .order('submitted_at', { ascending: false })

  const inviteById = new Map(invList.map((i) => [i.id, i]))
  const next: MonthlyFeedbackRow[] = []
  for (const r of resp ?? []) {
    const row = r as { id: string; invite_id: string; submitted_at: string; responses: Json }
    const inv = inviteById.get(row.invite_id)
    if (!inv) continue
    const form = formById.get(inv.form_id)
    if (!form) continue
    const obj =
      row.responses && typeof row.responses === 'object' && !Array.isArray(row.responses)
        ? (row.responses as Record<string, unknown>)
        : {}
    next.push({
      id: row.id,
      submittedAt: row.submitted_at,
      formTitle: form.title,
      questions: parseQuestions(form.questions),
      responses: obj,
    })
  }
  return next
}

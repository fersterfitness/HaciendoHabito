/** Dolores o molestias puntuales que el alumno reportó en el check-in semanal (pregunta `pain`). */

import { loadCheckInPoints } from '@/lib/checkIn/loadPoints'
import { CHECK_IN_SKIP_OPTION, optionById, parseStoredChoice, questionByKey, type CheckInQuestion } from '@/lib/checkIn/questions'

export type PainEvent = {
  /** Día del dolor (YYYY-MM-DD). Si el alumno no lo indicó, el día del check-in. */
  date: string
  /** true si la fecha es la del check-in (respuestas viejas, sin fecha). */
  approximate: boolean
  /** Zona / aclaración del alumno. */
  note: string
  submittedAt: string
}

type Point = { submittedAt: string; questions: CheckInQuestion[]; responses: Record<string, unknown> }

export function extractPainEvents(points: Point[]): PainEvent[] {
  const out: PainEvent[] = []
  for (const p of points) {
    const q = questionByKey(p.questions, 'pain')
    if (!q) continue
    const choice = parseStoredChoice(p.responses[q.id])
    if (!choice || choice.option === CHECK_IN_SKIP_OPTION) continue
    const opt = optionById(q, choice.option)
    // «Sí» es la opción roja `a` (también en formularios viejos sin fecha).
    if (choice.option !== 'a' && opt?.extra !== 'date') continue
    const extra = choice.extra?.trim() ?? ''
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(extra)
    out.push({
      date: valid ? extra : p.submittedAt.slice(0, 10),
      approximate: !valid,
      note: choice.note?.trim() ?? '',
      submittedAt: p.submittedAt,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export async function loadPainEvents(studentId: string): Promise<PainEvent[]> {
  return extractPainEvents(await loadCheckInPoints(studentId))
}

/** Dolores que caen dentro de [start, end] (fechas YYYY-MM-DD). */
export function painInRange(events: PainEvent[], start: string | null, end: string | null): PainEvent[] {
  if (!start || !end) return []
  return events.filter((e) => e.date >= start && e.date <= end)
}

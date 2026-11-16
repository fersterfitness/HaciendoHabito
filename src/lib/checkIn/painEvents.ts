/**
 * Dolores o molestias puntuales del alumno: los del check-in semanal viejo (pregunta `pain`) y los
 * «dolor no habitual» del chequeo diario del link, que ya traen los músculos marcados en el cuerpo.
 */

import { supabase } from '@/lib/supabase'
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
  /** Músculos marcados en el mapa (chequeo diario). Si falta, se deducen de la nota. */
  muscles?: string[]
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

/** Dolores no habituales del chequeo diario (20261120120000_daily_checkin_v2.sql). Sin la migración, vacío. */
async function loadDailyPainEvents(studentId: string): Promise<PainEvent[]> {
  const { data, error } = await supabase
    .from('routine_day_logs')
    .select('checkin_at, status_date, pain_areas, pain_note')
    .eq('student_id', studentId)
    .eq('pain_kind', 'unusual')
  if (error || !data) return []
  type Row = { checkin_at: string | null; status_date: string | null; pain_areas: string[] | null; pain_note: string | null }
  return (data as unknown as Row[])
    .filter((r) => r.checkin_at || r.status_date)
    .map((r) => ({
      date: r.status_date ?? r.checkin_at!.slice(0, 10),
      approximate: false,
      note: r.pain_note?.trim() ?? '',
      submittedAt: r.checkin_at ?? r.status_date!,
      muscles: r.pain_areas ?? [],
    }))
}

export async function loadPainEvents(studentId: string): Promise<PainEvent[]> {
  const [weekly, daily] = await Promise.all([loadCheckInPoints(studentId).then(extractPainEvents), loadDailyPainEvents(studentId)])
  return [...weekly, ...daily].sort((a, b) => a.date.localeCompare(b.date))
}

/** Dolores que caen dentro de [start, end] (fechas YYYY-MM-DD). */
export function painInRange(events: PainEvent[], start: string | null, end: string | null): PainEvent[] {
  if (!start || !end) return []
  return events.filter((e) => e.date >= start && e.date <= end)
}

import { supabase } from '@/lib/supabase'

/**
 * Días en que el alumno entrenó, según lo que registró desde su link (feedback nov19): el calendario se va
 * completando con esas fechas. Los bloques y las fases los sigue marcando el entrenador.
 * - done: cerró el día con «Terminé».
 * - sets: anotó series ese día pero no lo cerró.
 * - missed: marcó «No pude entrenar» (solo si ese día no entrenó otra cosa).
 */
export type TrainingDayMark = 'done' | 'sets' | 'missed'

type DayLog = { status: 'done' | 'missed' | null; status_date: string | null }
type SetLog = { updated_at: string }

const ymdLocal = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function trainingDaysFrom(dayLogs: DayLog[], setLogs: SetLog[]): Map<string, TrainingDayMark> {
  const out = new Map<string, TrainingDayMark>()
  for (const s of setLogs) out.set(ymdLocal(s.updated_at), 'sets')
  for (const d of dayLogs) {
    if (!d.status || !d.status_date) continue
    if (d.status === 'done') out.set(d.status_date, 'done')
    else if (!out.has(d.status_date)) out.set(d.status_date, 'missed')
  }
  return out
}

/** Registros del alumno en todas sus rutinas. Sin las tablas del link (migraciones de nov), vacío. */
export async function loadTrainingDays(studentId: string): Promise<Map<string, TrainingDayMark>> {
  const [days, sets] = await Promise.all([
    supabase.from('routine_day_logs').select('status, status_date').eq('student_id', studentId).not('status', 'is', null).range(0, 4999),
    supabase.from('routine_exercise_logs').select('updated_at').eq('student_id', studentId).range(0, 9999),
  ])
  return trainingDaysFrom((days.error ? [] : days.data ?? []) as DayLog[], (sets.error ? [] : sets.data ?? []) as SetLog[])
}

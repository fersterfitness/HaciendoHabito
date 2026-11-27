import { format, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { DAILY_SCALES, NUTRITION_ISSUES, PAIN_KINDS, SLEEP_HOURS, STEPS, muscleLabel, type ScaleKey } from '@/lib/routine/dailyCheckin'
import type { DayLog } from '@/lib/routine/studentTrainingLog'

/**
 * «Progreso» de la ficha del alumno (feedback nov3): todo lo que el alumno responde en su link
 * (chequeo diario, cierre del día, notas por ejercicio y avisos), agrupado por día, semana, mes o año.
 */

export type ProgressPeriod = 'day' | 'week' | 'month' | 'year'

export interface ProgressDay {
  /** yyyy-MM-dd: el día que cerró o, si no cerró, el día del chequeo. */
  date: string
  routineName: string
  log: DayLog
}

export interface ProgressNote {
  date: string
  kind: 'checkin' | 'pain' | 'missed' | 'nutrition' | 'exercise' | 'notice'
  title: string
  text: string
}

export interface ProgressBucket {
  key: string
  label: string
  done: number
  missed: number
  checkins: number
  unusualPain: number
  effort: number | null
  averages: Record<ScaleKey, number | null>
}

export interface StudentAppProgress {
  days: ProgressDay[]
  notes: ProgressNote[]
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
const label = (list: readonly { id: string; label: string }[], id: string | null | undefined) => list.find((o) => o.id === id)?.label ?? null

export function logDate(log: Pick<DayLog, 'status_date' | 'checkin_at'> & { updated_at?: string | null }): string | null {
  return log.status_date ?? log.checkin_at?.slice(0, 10) ?? log.updated_at?.slice(0, 10) ?? null
}

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
const parse = (s: string) => new Date(`${s}T12:00:00`)

export function bucketKey(date: string, period: ProgressPeriod): string {
  if (period === 'day') return date
  if (period === 'month') return date.slice(0, 7)
  if (period === 'year') return date.slice(0, 4)
  return ymd(startOfWeek(parse(date), { weekStartsOn: 1 }))
}

export function bucketLabel(key: string, period: ProgressPeriod): string {
  if (period === 'day') return format(parse(key), 'd MMM', { locale: es })
  if (period === 'week') return `Sem. ${format(parse(key), 'd MMM', { locale: es })}`
  if (period === 'month') return format(parse(`${key}-01`), 'MMM yy', { locale: es })
  return key
}

/** Desde qué fecha se mira cada período: 30 días, 16 semanas, 12 meses o todo. */
export function periodStart(period: ProgressPeriod, today: Date): string | null {
  if (period === 'day') return ymd(subDays(today, 29))
  if (period === 'week') return ymd(startOfWeek(subWeeks(today, 15), { weekStartsOn: 1 }))
  if (period === 'month') return `${format(subMonths(today, 11), 'yyyy-MM')}-01`
  return null
}

/** Agrupa los días por período, del más viejo al más nuevo. Solo períodos con algo cargado. */
export function progressBuckets(days: ProgressDay[], period: ProgressPeriod, from: string | null): ProgressBucket[] {
  const groups = new Map<string, ProgressDay[]>()
  for (const d of days) {
    if (from && d.date < from) continue
    const k = bucketKey(d.date, period)
    groups.set(k, [...(groups.get(k) ?? []), d])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      const logs = list.map((d) => d.log)
      const averages = Object.fromEntries(
        DAILY_SCALES.map((s) => [s.key, avg(logs.map((l) => l[s.key]).filter((v): v is number => typeof v === 'number'))]),
      ) as Record<ScaleKey, number | null>
      return {
        key,
        label: bucketLabel(key, period),
        done: logs.filter((l) => l.status === 'done').length,
        missed: logs.filter((l) => l.status === 'missed').length,
        checkins: logs.filter((l) => !!l.checkin_at || DAILY_SCALES.some((s) => typeof l[s.key] === 'number')).length,
        unusualPain: logs.filter((l) => l.pain_kind === 'unusual').length,
        effort: avg(logs.map((l) => l.effort).filter((v): v is number => v != null)),
        averages,
      }
    })
}

/**
 * Feedback nov27 (4b): la grilla semana a semana del entrenador. Lee cada promedio (1 a 5) a favor del
 * alumno, como en su link: en estrés y dolores, más bajo es mejor.
 */
export function scaleTone(value: number | null, good: 'high' | 'low'): 'good' | 'mid' | 'low' | null {
  if (value == null) return null
  const score = good === 'high' ? value : 6 - value
  return score >= 4 ? 'good' : score >= 3 ? 'mid' : 'low'
}

/** Lo que el alumno escribió o marcó y conviene leer, día por día. */
export function notesFromDays(days: ProgressDay[]): ProgressNote[] {
  const out: ProgressNote[] = []
  for (const { date, log } of days) {
    if (log.pain_kind === 'unusual' || (log.pain_note ?? '').trim()) {
      const areas = (log.pain_areas ?? []).map(muscleLabel).join(', ')
      out.push({
        date,
        kind: 'pain',
        title: label(PAIN_KINDS, log.pain_kind) ?? 'Dolor',
        text: [areas, (log.pain_note ?? '').trim()].filter(Boolean).join(' · ') || 'Sin detalle',
      })
    }
    if (log.status === 'missed') out.push({ date, kind: 'missed', title: 'No entrenó', text: log.missed_reason.trim() || 'Sin motivo' })
    if (log.nutrition_issue) {
      const issue = label(NUTRITION_ISSUES, log.nutrition_issue) ?? log.nutrition_issue
      out.push({ date, kind: 'nutrition', title: 'Alimentación', text: [issue, (log.nutrition_issue_note ?? '').trim()].filter(Boolean).join(' · ') })
    }
    const extra = [
      log.sleep_hours ? `Durmió: ${label(SLEEP_HOURS, log.sleep_hours) ?? log.sleep_hours}` : '',
      log.steps_avg ? `Pasos: ${label(STEPS, log.steps_avg) ?? log.steps_avg}` : '',
    ].filter(Boolean)
    if (log.checkin_note.trim()) out.push({ date, kind: 'checkin', title: 'Chequeo', text: [log.checkin_note.trim(), ...extra].join(' · ') })
  }
  return out
}

/** Carga todo lo del alumno (todas sus rutinas). Sin las migraciones del registro, vacío. */
export async function loadStudentAppProgress(ownerId: string, studentId: string): Promise<StudentAppProgress> {
  const { data: routines } = await supabase.from('routines').select('id, name').eq('owner_id', ownerId).eq('student_id', studentId)
  const names = new Map((routines ?? []).map((r: { id: string; name: string | null }) => [r.id, r.name?.trim() || 'Rutina']))
  const ids = [...names.keys()]
  if (!ids.length) return { days: [], notes: [] }

  const [logsRes, fbRes, msgRes] = await Promise.all([
    supabase.from('routine_day_logs').select('*').in('routine_id', ids).range(0, 4999),
    supabase
      .from('routine_exercise_feedback')
      .select('note, effort, updated_at, routine_id, routine_exercises(name)')
      .in('routine_id', ids)
      .neq('note', '')
      .range(0, 1999),
    supabase
      .from('student_urgent_messages')
      .select('kind, message, created_at')
      .eq('owner_id', ownerId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  const days: ProgressDay[] = []
  for (const row of (logsRes.data ?? []) as (DayLog & { routine_id: string; updated_at?: string | null })[]) {
    const date = logDate(row)
    if (!date) continue
    days.push({ date, routineName: names.get(row.routine_id) ?? 'Rutina', log: { ...row, checkin_note: row.checkin_note ?? '', missed_reason: row.missed_reason ?? '' } })
  }
  days.sort((a, b) => a.date.localeCompare(b.date))

  const notes = notesFromDays(days)
  type Fb = { note: string; updated_at: string; routine_exercises: { name: string | null } | { name: string | null }[] | null }
  for (const f of (fbRes.data ?? []) as Fb[]) {
    const ex = Array.isArray(f.routine_exercises) ? f.routine_exercises[0] : f.routine_exercises
    notes.push({ date: f.updated_at.slice(0, 10), kind: 'exercise', title: ex?.name?.trim() || 'Ejercicio', text: f.note.trim() })
  }
  for (const m of (msgRes.data ?? []) as { kind: string; message: string; created_at: string }[]) {
    if (m.kind === 'pain') continue // ya figura como dolor del día
    notes.push({ date: m.created_at.slice(0, 10), kind: 'notice', title: m.kind === 'urgent' ? 'Consulta urgente' : 'Aviso', text: m.message })
  }
  notes.sort((a, b) => b.date.localeCompare(a.date))
  return { days, notes }
}

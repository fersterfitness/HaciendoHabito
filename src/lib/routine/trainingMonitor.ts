import { supabase } from '@/lib/supabase'
import { currentBlockIndex } from '@/lib/routine/sharedRoutine'

/**
 * Monitor de entrenamiento del entrenador: cómo viene HOY cada alumno con rutina activa, según lo
 * que va anotando desde su link (series en `routine_exercise_logs`, cierre del día en `routine_day_logs`).
 *
 * Si el entrenador le puso día de la semana a cada entrenamiento (`routine_days.day_of_week`), el monitor
 * sabe qué le toca hoy y qué dejó sin hacer en la semana. Sin eso, «no entrenó» sale solo cuando el alumno
 * lo marca y el resto queda como «sin registro hoy».
 */

/** Minutos sin anotar nada tras los cuales ya no se lo considera entrenando. */
export const LIVE_WINDOW_MINUTES = 15
/** Por debajo de este porcentaje de series hechas, el día cuenta como «con desvíos». */
export const DEVIATION_MIN_PCT = 80

export type MonitorState = 'live' | 'deviated' | 'missed' | 'done' | 'due' | 'idle'

/** Días de la semana como los da `Date.getDay()`: 0 domingo … 6 sábado. */
export const WEEKDAY_LABELS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const

export interface MonitorExercise {
  id: string
  /** Ejercicio de la biblioteca: sirve para comparar con el mismo ejercicio de la semana anterior. */
  exercise_id: string
  sets: number | null
  weight_kg: number | null
}
export interface MonitorDay {
  id: string
  day_name: string
  muscle_focus: string | null
  sort_order: number
  /** Día de la semana asignado (0 domingo … 6 sábado), o null si no tiene día fijo. */
  day_of_week?: number | null
  exercises: MonitorExercise[]
}
export interface MonitorBlock {
  id: string
  sort_order: number
  start_date: string | null
  end_date: string | null
  days: MonitorDay[]
}
export interface MonitorRoutine {
  id: string
  student_id: string
  student_name: string
  avatar_path: string | null
  blocks: MonitorBlock[]
}
export interface MonitorSetLog {
  routine_exercise_id: string
  set_number: number
  weight_kg: number | null
  completed: boolean | null
  updated_at: string
}
export interface MonitorDayLog {
  routine_day_id: string
  status: 'done' | 'missed' | null
  status_date: string | null
  missed_reason: string | null
}

export interface MonitorRow {
  routineId: string
  studentId: string
  studentName: string
  avatarPath: string | null
  state: MonitorState
  /** «Día 2 · Torso A»; vacío cuando no registró nada hoy. */
  dayLabel: string
  /** Renglón de detalle: «Serie 9 de 21», «Cumplió el 95 %», «Salteó 2 ejercicios · bajó cargas en 1»… */
  detail: string
  /** 0–100, cuando hay series planificadas en el día de hoy. */
  pct: number | null
  /** Cuándo anotó por última vez hoy (ISO), para ordenar. */
  lastAt: string | null
}

const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function labelOf(day: MonitorDay): string {
  const name = day.day_name?.trim() || `Día ${day.sort_order + 1}`
  const focus = day.muscle_focus?.trim()
  return focus && !name.toLowerCase().includes(focus.toLowerCase()) ? `${name} · ${focus}` : name
}

const STATE_ORDER: Record<MonitorState, number> = { live: 0, deviated: 1, missed: 2, done: 3, due: 4, idle: 5 }

/** Posición en la semana empezando por el lunes (lunes 0 … domingo 6). */
const mondayIndex = (dow: number) => (dow + 6) % 7

/** Una fila por rutina activa, ordenadas: entrenando ahora, con desvíos, no entrenó, entrenó, le toca hoy, sin registro. */
export function buildTrainingMonitor(opts: { routines: MonitorRoutine[]; setLogs: MonitorSetLog[]; dayLogs: MonitorDayLog[]; now: Date }): MonitorRow[] {
  const today = ymdLocal(opts.now)
  const logsByExercise = new Map<string, MonitorSetLog[]>()
  for (const l of opts.setLogs) {
    const list = logsByExercise.get(l.routine_exercise_id)
    if (list) list.push(l)
    else logsByExercise.set(l.routine_exercise_id, [l])
  }
  const dayLogById = new Map(opts.dayLogs.map((d) => [d.routine_day_id, d]))
  const doneSets = (ex: MonitorExercise) => (logsByExercise.get(ex.id) ?? []).filter((l) => l.completed !== false)
  const maxWeight = (ex: MonitorExercise) => doneSets(ex).reduce<number | null>((m, l) => (l.weight_kg != null && (m == null || l.weight_kg > m) ? l.weight_kg : m), null)

  const rows = opts.routines.map((r): MonitorRow => {
    const base = { routineId: r.id, studentId: r.student_id, studentName: r.student_name, avatarPath: r.avatar_path }
    const blocks = [...r.blocks].sort((a, b) => a.sort_order - b.sort_order)
    const blockIndex = currentBlockIndex(blocks, today)
    const block = blocks[blockIndex]
    const days = block ? [...block.days].sort((a, b) => a.sort_order - b.sort_order) : []

    // El día de hoy: el que tiene la serie anotada más reciente de hoy; si no, el que cerró hoy.
    let active: MonitorDay | null = null
    let lastAt: string | null = null
    for (const d of days) {
      for (const ex of d.exercises) {
        for (const l of logsByExercise.get(ex.id) ?? []) {
          if (ymdLocal(new Date(l.updated_at)) !== today) continue
          if (!lastAt || l.updated_at > lastAt) {
            lastAt = l.updated_at
            active = d
          }
        }
      }
    }
    const closedToday = days.find((d) => dayLogById.get(d.id)?.status_date === today && dayLogById.get(d.id)?.status)
    if (!active && closedToday) active = closedToday

    if (!active) {
      const closed = days.filter((d) => dayLogById.get(d.id)?.status).length
      const untouched = (d: MonitorDay) => !dayLogById.get(d.id)?.status && d.exercises.every((ex) => (logsByExercise.get(ex.id) ?? []).length === 0)
      const todayDow = opts.now.getDay()
      // Con día de la semana asignado: lo que le toca hoy y lo que dejó sin hacer en los días anteriores.
      const dueToday = days.find((d) => d.day_of_week === todayDow && untouched(d))
      const owed = days.filter((d) => d.day_of_week != null && mondayIndex(d.day_of_week) < mondayIndex(todayDow) && untouched(d))
      const owedText = owed.length ? `No hizo ${owed.map((d) => `${labelOf(d)} (${WEEKDAY_LABELS[d.day_of_week!]})`).join(', ')}` : ''
      if (dueToday) {
        return { ...base, state: 'due', dayLabel: labelOf(dueToday), detail: owedText || 'Todavía no registró nada', pct: null, lastAt: null }
      }
      const next = days.find((d) => !dayLogById.get(d.id)?.status)
      const week = days.length ? `${closed} de ${plural(days.length, 'día', 'días')} esta semana` : 'La rutina no tiene días cargados'
      const detail = owedText ? `${owedText} · ${week}` : days.length && next ? `${week} · sigue ${labelOf(next)}` : week
      return { ...base, state: 'idle', dayLabel: '', detail, pct: null, lastAt: null }
    }

    const log = dayLogById.get(active.id)
    const status = log?.status_date === today ? log.status : null
    const dayLabel = labelOf(active)
    if (status === 'missed') {
      return { ...base, state: 'missed', dayLabel, detail: log?.missed_reason?.trim() || 'No dejó el motivo', pct: null, lastAt }
    }

    const planned = active.exercises.reduce((sum, ex) => sum + (ex.sets ?? 0), 0)
    const done = active.exercises.reduce((sum, ex) => sum + Math.min(doneSets(ex).length, ex.sets ?? doneSets(ex).length), 0)
    const pct = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : null

    const minutesAgo = lastAt ? (opts.now.getTime() - new Date(lastAt).getTime()) / 60_000 : Infinity
    if (status !== 'done' && minutesAgo <= LIVE_WINDOW_MINUTES) {
      return { ...base, state: 'live', dayLabel, detail: planned > 0 ? `Serie ${done} de ${planned}` : plural(done, 'serie anotada', 'series anotadas'), pct, lastAt }
    }

    // Desvíos: ejercicios sin ninguna serie (solo si cerró el día) y cargas por debajo de lo planificado
    // o, si no hay kilos planificados, de lo que levantó en ese ejercicio la semana anterior.
    const skipped = status === 'done' ? active.exercises.filter((ex) => (ex.sets ?? 0) > 0 && doneSets(ex).length === 0).length : 0
    const prevDay = blockIndex > 0 ? [...(blocks[blockIndex - 1]?.days ?? [])].sort((a, b) => a.sort_order - b.sort_order)[days.indexOf(active)] : undefined
    const lower = active.exercises.filter((ex) => {
      const lifted = maxWeight(ex)
      if (lifted == null) return false
      if (ex.weight_kg != null && ex.weight_kg > 0) return lifted < ex.weight_kg
      const before = prevDay?.exercises.find((p) => p.exercise_id === ex.exercise_id)
      const prevLifted = before ? maxWeight(before) : null
      return prevLifted != null && lifted < prevLifted
    }).length

    const notes: string[] = []
    if (skipped) notes.push(`Salteó ${plural(skipped, 'ejercicio', 'ejercicios')}`)
    if (lower) notes.push(`${notes.length ? 'bajó' : 'Bajó'} cargas en ${lower}`)
    const lowPct = status === 'done' && pct != null && pct < DEVIATION_MIN_PCT
    if (notes.length || lowPct) {
      if (pct != null) notes.push(`${notes.length ? 'hizo' : 'Hizo'} el ${pct} %`)
      return { ...base, state: 'deviated', dayLabel, detail: notes.join(' · '), pct, lastAt }
    }
    const detail = status === 'done' ? (pct != null ? `Cumplió el ${pct} % del día` : 'Día terminado') : pct != null ? `Lleva el ${pct} % · todavía no cerró el día` : 'Todavía no cerró el día'
    return { ...base, state: 'done', dayLabel, detail, pct, lastAt }
  })

  return rows.sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (b.lastAt ?? '').localeCompare(a.lastAt ?? '') || a.studentName.localeCompare(b.studentName, 'es'),
  )
}

// ───────────── Datos ─────────────

type RoutineRow = {
  id: string
  student_id: string | null
  student: { full_name: string; avatar_path: string | null } | null
  blocks: MonitorBlock[] | null
}

/** Rutinas activas del entrenador con su estructura (semanas, días, ejercicios). Cambia poco: se pide de vez en cuando. */
export async function loadMonitorRoutines(ownerId: string): Promise<MonitorRoutine[]> {
  const { data, error } = await supabase
    .from('routines')
    .select(
      'id, student_id, student:students(full_name, avatar_path), blocks:routine_blocks(id, sort_order, start_date, end_date, days:routine_days(id, day_name, muscle_focus, sort_order, day_of_week, exercises:routine_exercises(id, exercise_id, sets, weight_kg)))',
    )
    .eq('owner_id', ownerId)
    .in('status', ['activa', 'por_vencer'])
    .not('student_id', 'is', null)
  if (error || !data) return []
  return (data as unknown as RoutineRow[])
    .filter((r) => r.student_id && r.student)
    .map((r) => ({ id: r.id, student_id: r.student_id!, student_name: r.student!.full_name, avatar_path: r.student!.avatar_path, blocks: r.blocks ?? [] }))
}

/** Lo anotado por los alumnos en esas rutinas. Sin las tablas (faltan las migraciones) devuelve vacío. */
export async function loadMonitorLogs(routineIds: string[]): Promise<{ setLogs: MonitorSetLog[]; dayLogs: MonitorDayLog[] }> {
  if (routineIds.length === 0) return { setLogs: [], dayLogs: [] }
  const [sets, days] = await Promise.all([
    supabase.from('routine_exercise_logs').select('routine_exercise_id, set_number, weight_kg, completed, updated_at').in('routine_id', routineIds).limit(20000),
    supabase.from('routine_day_logs').select('routine_day_id, status, status_date, missed_reason').in('routine_id', routineIds).limit(5000),
  ])
  return { setLogs: (sets.data ?? []) as MonitorSetLog[], dayLogs: (days.data ?? []) as MonitorDayLog[] }
}

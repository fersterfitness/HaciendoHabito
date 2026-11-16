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
  /** Nombre del ejercicio en la biblioteca, para la actividad en vivo. */
  name?: string | null
  /** Descanso planificado entre series, en segundos. */
  rest_seconds?: number | null
  /** Orden dentro del día. */
  sort_order?: number | null
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
  reps?: number | null
  completed: boolean | null
  updated_at: string
}
export interface MonitorDayLog {
  routine_day_id: string
  status: 'done' | 'missed' | null
  status_date: string | null
  missed_reason: string | null
  /** Cuándo se guardó el cierre (ISO), para ubicarlo en la actividad en vivo. */
  updated_at?: string | null
  /** Chequeo previo (1 a 5): sueño y energía, mejor cuanto más alto; estrés y molestias, peor cuanto más alto. */
  sleep?: number | null
  energy?: number | null
  stress?: number | null
  soreness?: number | null
  checkin_note?: string | null
  checkin_at?: string | null
  /** Esfuerzo de la sesión al cerrar el día (Borg 1 a 10). */
  effort?: number | null
}

/** Lo que anotó el alumno sobre un ejercicio (una fila por ejercicio, se pisa en cada sesión). */
export interface MonitorFeedback {
  routine_exercise_id: string
  note: string | null
  effort: number | null
  updated_at: string
}

/** Cómo llegó hoy, del chequeo previo. */
export interface MonitorCheckin {
  sleep: number | null
  energy: number | null
  stress: number | null
  soreness: number | null
  note: string
}

/** Borg desde el que el esfuerzo de un ejercicio se marca como alto. */
export const HIGH_EFFORT = 9

/** true si alguna respuesta del chequeo merece atención: dormir o energía en 1–2, estrés o molestias en 4–5. */
export function checkinFlags(c: MonitorCheckin): ('sleep' | 'energy' | 'stress' | 'soreness')[] {
  const out: ('sleep' | 'energy' | 'stress' | 'soreness')[] = []
  if (c.sleep != null && c.sleep <= 2) out.push('sleep')
  if (c.energy != null && c.energy <= 2) out.push('energy')
  if (c.stress != null && c.stress >= 4) out.push('stress')
  if (c.soreness != null && c.soreness >= 4) out.push('soreness')
  return out
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
  /** Series hechas y planificadas del día que está entrenando (cuando registró algo hoy). */
  doneSets?: number
  plannedSets?: number
  /** Kilos movidos en ese día: suma de kilos × repeticiones de las series que tienen los dos datos. */
  volumeKg?: number
  /** El ejercicio de la última serie anotada hoy, con lo que levantó y lo planificado. */
  current?: MonitorCurrent
  /** Todos los ejercicios del día que está entrenando, en orden, con lo hecho hoy. */
  exercises?: MonitorCurrent[]
  /** Primera serie anotada hoy en ese día (ISO): cuándo empezó a entrenar. */
  startedAt?: string | null
  /** Chequeo previo, si lo respondió hoy. */
  checkin?: MonitorCheckin
  /** Esfuerzo de la sesión que marcó al cerrar el día hoy (Borg 1 a 10). */
  dayEffort?: number | null
  /** true si cerró hoy el día como terminado. */
  closed?: boolean
}

export interface MonitorCurrent {
  /** id de `routine_exercises`. */
  exerciseId: string
  name: string
  /** Series hechas de ese ejercicio y las planificadas (null si no tiene número de series). */
  setsDone: number
  setsPlanned: number | null
  /** Kilos y repeticiones de la última serie anotada. */
  weightKg: number | null
  reps: number | null
  /** Kilos planificados para ese ejercicio, si los hay. */
  plannedKg: number | null
  /** Descanso planificado entre series (segundos). */
  restSeconds: number | null
  /** Esfuerzo (Borg) y nota que dejó hoy sobre este ejercicio. */
  effort: number | null
  note: string
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
export function buildTrainingMonitor(opts: { routines: MonitorRoutine[]; setLogs: MonitorSetLog[]; dayLogs: MonitorDayLog[]; feedback?: MonitorFeedback[]; now: Date }): MonitorRow[] {
  const today = ymdLocal(opts.now)
  const isToday = (iso: string | null | undefined) => !!iso && ymdLocal(new Date(iso)) === today
  // Solo lo que anotó hoy: la fila de cada ejercicio se pisa en cada sesión.
  const feedbackByExercise = new Map((opts.feedback ?? []).filter((f) => isToday(f.updated_at)).map((f) => [f.routine_exercise_id, f]))
  const logsByExercise = new Map<string, MonitorSetLog[]>()
  for (const l of opts.setLogs) {
    const list = logsByExercise.get(l.routine_exercise_id)
    if (list) list.push(l)
    else logsByExercise.set(l.routine_exercise_id, [l])
  }
  const dayLogById = new Map(opts.dayLogs.map((d) => [d.routine_day_id, d]))
  const doneSets = (ex: MonitorExercise) => (logsByExercise.get(ex.id) ?? []).filter((l) => l.completed !== false)
  const maxOf = (logs: MonitorSetLog[]) => logs.reduce<number | null>((m, l) => (l.weight_kg != null && (m == null || l.weight_kg > m) ? l.weight_kg : m), null)
  const maxWeight = (ex: MonitorExercise) => maxOf(doneSets(ex))
  // Hay una fila por número de serie y se pisa en cada sesión: lo de hoy es lo que se guardó hoy. Las series
  // que quedaron de otra sesión (el mismo día de la rutina, otra semana) no cuentan para el avance de hoy.
  const todaySets = (ex: MonitorExercise) => doneSets(ex).filter((l) => ymdLocal(new Date(l.updated_at)) === today)

  const rows = opts.routines.map((r): MonitorRow => {
    const base = { routineId: r.id, studentId: r.student_id, studentName: r.student_name, avatarPath: r.avatar_path }
    const blocks = [...r.blocks].sort((a, b) => a.sort_order - b.sort_order)
    const blockIndex = currentBlockIndex(blocks, today)
    const block = blocks[blockIndex]
    const days = block ? [...block.days].sort((a, b) => a.sort_order - b.sort_order) : []

    // El día de hoy: el que tiene la serie anotada más reciente de hoy; si no, el que cerró hoy.
    let active: MonitorDay | null = null
    let lastAt: string | null = null
    let lastEx: MonitorExercise | null = null
    let lastLog: MonitorSetLog | null = null
    for (const d of days) {
      for (const ex of d.exercises) {
        for (const l of logsByExercise.get(ex.id) ?? []) {
          if (ymdLocal(new Date(l.updated_at)) !== today) continue
          if (!lastAt || l.updated_at > lastAt) {
            lastAt = l.updated_at
            active = d
            lastEx = ex
            lastLog = l
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
    // «No entrené» pero después anotó series: entrenó al final, cuenta como entrenamiento.
    const trainedAfterMissed = status === 'missed' && !!lastAt && !!log?.updated_at && lastAt > log.updated_at
    if (status === 'missed' && !trainedAfterMissed) {
      return { ...base, state: 'missed', dayLabel, detail: log?.missed_reason?.trim() || 'No dejó el motivo', pct: null, lastAt }
    }

    const planned = active.exercises.reduce((sum, ex) => sum + (ex.sets ?? 0), 0)
    const done = active.exercises.reduce((sum, ex) => sum + Math.min(todaySets(ex).length, ex.sets ?? todaySets(ex).length), 0)
    const pct = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : null
    const volumeKg = Math.round(
      active.exercises.reduce((sum, ex) => sum + todaySets(ex).reduce((v, l) => v + (l.weight_kg != null && l.reps != null ? l.weight_kg * l.reps : 0), 0), 0),
    )
    const exerciseOf = (ex: MonitorExercise): MonitorCurrent => {
      const logs = todaySets(ex).sort((a, b) => a.updated_at.localeCompare(b.updated_at))
      const last = logs[logs.length - 1]
      return {
        exerciseId: ex.id,
        name: ex.name?.trim() || 'Ejercicio',
        setsDone: logs.length,
        setsPlanned: ex.sets ?? null,
        weightKg: last?.weight_kg ?? null,
        reps: last?.reps ?? null,
        plannedKg: ex.weight_kg != null && ex.weight_kg > 0 ? ex.weight_kg : null,
        restSeconds: ex.rest_seconds != null && ex.rest_seconds > 0 ? ex.rest_seconds : null,
        effort: feedbackByExercise.get(ex.id)?.effort ?? null,
        note: feedbackByExercise.get(ex.id)?.note?.trim() ?? '',
      }
    }
    const current = lastEx && lastLog ? exerciseOf(lastEx) : undefined
    const startedAt = active.exercises.flatMap(todaySets).reduce<string | null>((m, l) => (!m || l.updated_at < m ? l.updated_at : m), null)
    const checkin: MonitorCheckin | undefined =
      log && isToday(log.checkin_at) && [log.sleep, log.energy, log.stress, log.soreness].some((v) => v != null)
        ? { sleep: log.sleep ?? null, energy: log.energy ?? null, stress: log.stress ?? null, soreness: log.soreness ?? null, note: log.checkin_note?.trim() ?? '' }
        : undefined
    const extra = {
      doneSets: done,
      plannedSets: planned,
      volumeKg,
      current,
      exercises: active.exercises.map(exerciseOf),
      startedAt,
      checkin,
      dayEffort: status === 'done' ? (log?.effort ?? null) : null,
      closed: status === 'done',
    }

    const minutesAgo = lastAt ? (opts.now.getTime() - new Date(lastAt).getTime()) / 60_000 : Infinity
    if (status !== 'done' && minutesAgo <= LIVE_WINDOW_MINUTES) {
      return { ...base, ...extra, state: 'live', dayLabel, detail: planned > 0 ? `Serie ${done} de ${planned}` : plural(done, 'serie anotada', 'series anotadas'), pct, lastAt }
    }

    // Desvíos: ejercicios sin ninguna serie (solo si cerró el día) y cargas por debajo de lo planificado
    // o, si no hay kilos planificados, de lo que levantó en ese ejercicio la semana anterior.
    const skipped = status === 'done' ? active.exercises.filter((ex) => (ex.sets ?? 0) > 0 && todaySets(ex).length === 0).length : 0
    const prevDay = blockIndex > 0 ? [...(blocks[blockIndex - 1]?.days ?? [])].sort((a, b) => a.sort_order - b.sort_order)[days.indexOf(active)] : undefined
    const lower = active.exercises.filter((ex) => {
      const lifted = maxOf(todaySets(ex))
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
      return { ...base, ...extra, state: 'deviated', dayLabel, detail: notes.join(' · '), pct, lastAt }
    }
    const detail = status === 'done' ? (pct != null ? `Cumplió el ${pct} % del día` : 'Día terminado') : pct != null ? `Lleva el ${pct} % · todavía no cerró el día` : 'Todavía no cerró el día'
    return { ...base, ...extra, state: 'done', dayLabel, detail, pct, lastAt }
  })

  return rows.sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (b.lastAt ?? '').localeCompare(a.lastAt ?? '') || a.studentName.localeCompare(b.studentName, 'es'),
  )
}

// ───────────── El día en números ─────────────

export interface MonitorSummary {
  /** Series anotadas hoy por todos los alumnos. */
  setsToday: number
  /** Kilos movidos hoy (kilos × repeticiones). */
  volumeKg: number
  /** Promedio del avance de quienes entrenaron hoy (0–100), o `null` si nadie tiene series planificadas. */
  avgPct: number | null
  doneToday: number
  plannedToday: number
  /** Series por hora del día (0–23), para ver a qué hora entrenan. */
  hourly: number[]
  /** Hora con más series, o `null` si no hubo. */
  peakHour: number | null
  /**
   * Kilos movidos el mismo día de la semana pasada hasta esta misma hora (comparación pareja a mitad
   * del día), o `null` si ese día no se anotó nada.
   */
  volumePrevKg: number | null
}

export function monitorSummary(opts: { rows: MonitorRow[]; setLogs: MonitorSetLog[]; now: Date }): MonitorSummary {
  const today = ymdLocal(opts.now)
  const hourly = Array<number>(24).fill(0)
  let setsToday = 0
  let volumeKg = 0
  const weekAgo = new Date(opts.now.getTime() - 7 * 86_400_000)
  const weekAgoYmd = ymdLocal(weekAgo)
  let prevSets = 0
  let volumePrev = 0
  for (const l of opts.setLogs) {
    if (l.completed === false) continue
    const at = new Date(l.updated_at)
    if (ymdLocal(at) === weekAgoYmd && at.getTime() <= weekAgo.getTime()) {
      prevSets += 1
      if (l.weight_kg != null && l.reps != null) volumePrev += l.weight_kg * l.reps
      continue
    }
    if (ymdLocal(at) !== today) continue
    setsToday += 1
    hourly[at.getHours()] += 1
    if (l.weight_kg != null && l.reps != null) volumeKg += l.weight_kg * l.reps
  }
  const trained = opts.rows.filter((r) => (r.state === 'live' || r.state === 'done' || r.state === 'deviated') && r.pct != null)
  const max = Math.max(...hourly)
  return {
    setsToday,
    volumeKg: Math.round(volumeKg),
    avgPct: trained.length ? Math.round(trained.reduce((n, r) => n + r.pct!, 0) / trained.length) : null,
    doneToday: trained.reduce((n, r) => n + (r.doneSets ?? 0), 0),
    plannedToday: trained.reduce((n, r) => n + (r.plannedSets ?? 0), 0),
    hourly,
    peakHour: max > 0 ? hourly.indexOf(max) : null,
    volumePrevKg: prevSets > 0 ? Math.round(volumePrev) : null,
  }
}

// ───────────── Actividad de la semana ─────────────

export interface WeekActivityDay {
  /** yyyy-MM-dd */
  ymd: string
  /** «L», «M», «X»… */
  short: string
  /** «lunes» */
  name: string
  /** Alumnos que anotaron al menos una serie o cerraron un día como terminado. */
  trained: number
  /** Alumnos que avisaron que no entrenaban. */
  missed: number
  isToday: boolean
  isFuture: boolean
}

const WEEK_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** De lunes a domingo de la semana en curso: cuántos alumnos entrenaron cada día. */
export function weekActivity(opts: { routines: MonitorRoutine[]; setLogs: MonitorSetLog[]; dayLogs: MonitorDayLog[]; now: Date }): WeekActivityDay[] {
  const studentByExercise = new Map<string, string>()
  const studentByDay = new Map<string, string>()
  for (const r of opts.routines)
    for (const b of r.blocks)
      for (const d of b.days) {
        studentByDay.set(d.id, r.student_id)
        for (const ex of d.exercises) studentByExercise.set(ex.id, r.student_id)
      }
  const trained = new Map<string, Set<string>>()
  const missed = new Map<string, Set<string>>()
  const add = (m: Map<string, Set<string>>, ymd: string, student: string) => {
    const set = m.get(ymd)
    if (set) set.add(student)
    else m.set(ymd, new Set([student]))
  }
  for (const l of opts.setLogs) {
    const student = studentByExercise.get(l.routine_exercise_id)
    if (student && l.completed !== false) add(trained, ymdLocal(new Date(l.updated_at)), student)
  }
  for (const l of opts.dayLogs) {
    const student = studentByDay.get(l.routine_day_id)
    if (!student || !l.status || !l.status_date) continue
    add(l.status === 'done' ? trained : missed, l.status_date, student)
  }

  const today = ymdLocal(opts.now)
  const monday = new Date(opts.now.getFullYear(), opts.now.getMonth(), opts.now.getDate() - mondayIndex(opts.now.getDay()))
  return WEEK_SHORT.map((short, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const ymd = ymdLocal(d)
    const t = trained.get(ymd) ?? new Set<string>()
    // Quien entrenó ese día no cuenta además como «no entrenó».
    const m = [...(missed.get(ymd) ?? [])].filter((st) => !t.has(st)).length
    return { ymd, short, name: WEEKDAY_LABELS[d.getDay()], trained: t.size, missed: m, isToday: ymd === today, isFuture: ymd > today }
  })
}

// ───────────── Actividad en vivo ─────────────

export interface MonitorEvent {
  id: string
  /** Momento del evento (ISO). */
  at: string
  routineId: string
  studentName: string
  avatarPath: string | null
  kind: 'sets' | 'done' | 'missed'
  /** «Press de banca» o «Día 1 · Torso A». */
  title: string
  /** «3 series · 40 kg × 10», «Cerró el día», el motivo… */
  detail: string
}

/** Minutos entre dos series del mismo ejercicio para contarlas como un solo evento. */
const FEED_MERGE_MINUTES = 12

/**
 * Lo que fue pasando hoy, de lo más nuevo a lo más viejo: series anotadas (agrupadas por ejercicio),
 * días cerrados y avisos de «no entreno».
 */
export function monitorFeed(opts: { routines: MonitorRoutine[]; setLogs: MonitorSetLog[]; dayLogs: MonitorDayLog[]; now: Date; limit?: number }): MonitorEvent[] {
  const today = ymdLocal(opts.now)
  type Owner = { routineId: string; studentName: string; avatarPath: string | null; dayLabel: string; name: string }
  const byExercise = new Map<string, Owner>()
  const byDay = new Map<string, Owner>()
  for (const r of opts.routines)
    for (const b of r.blocks)
      for (const d of b.days) {
        const base = { routineId: r.id, studentName: r.student_name, avatarPath: r.avatar_path, dayLabel: labelOf(d) }
        byDay.set(d.id, { ...base, name: labelOf(d) })
        for (const ex of d.exercises) byExercise.set(ex.id, { ...base, name: ex.name?.trim() || 'Ejercicio' })
      }

  const events: MonitorEvent[] = []
  const todays = opts.setLogs
    .filter((l) => l.completed !== false && ymdLocal(new Date(l.updated_at)) === today && byExercise.has(l.routine_exercise_id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  // Series seguidas del mismo ejercicio → un evento («3 series · 40 kg × 10»).
  const open = new Map<string, { event: MonitorEvent; count: number; oldest: string; last: MonitorSetLog }>()
  for (const l of todays) {
    const owner = byExercise.get(l.routine_exercise_id)!
    const group = open.get(l.routine_exercise_id)
    if (group && (new Date(group.oldest).getTime() - new Date(l.updated_at).getTime()) / 60_000 <= FEED_MERGE_MINUTES) {
      group.count += 1
      group.oldest = l.updated_at
      group.event.detail = setsDetail(group.count, group.last)
      continue
    }
    const event: MonitorEvent = {
      id: `s:${l.routine_exercise_id}:${l.updated_at}`,
      at: l.updated_at,
      routineId: owner.routineId,
      studentName: owner.studentName,
      avatarPath: owner.avatarPath,
      kind: 'sets',
      title: owner.name,
      detail: setsDetail(1, l),
    }
    events.push(event)
    open.set(l.routine_exercise_id, { event, count: 1, oldest: l.updated_at, last: l })
  }

  for (const d of opts.dayLogs) {
    const owner = byDay.get(d.routine_day_id)
    if (!owner || !d.status || d.status_date !== today) continue
    events.push({
      id: `d:${d.routine_day_id}:${d.status}`,
      // Sin hora guardada, el cierre va al final del día de hoy conocido: justo ahora.
      at: d.updated_at && ymdLocal(new Date(d.updated_at)) === today ? d.updated_at : opts.now.toISOString(),
      routineId: owner.routineId,
      studentName: owner.studentName,
      avatarPath: owner.avatarPath,
      kind: d.status,
      title: owner.dayLabel,
      detail: d.status === 'done' ? 'Cerró el día' : d.missed_reason?.trim() || 'Avisó que no entrena',
    })
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, opts.limit ?? 40)
}

function setsDetail(count: number, last: MonitorSetLog): string {
  const load = last.weight_kg != null ? `${fmtKg(last.weight_kg)} kg${last.reps != null ? ` × ${last.reps}` : ''}` : last.reps != null ? `${last.reps} repeticiones` : ''
  return [plural(count, 'serie', 'series'), load].filter(Boolean).join(' · ')
}
const fmtKg = (n: number) => Number(n.toFixed(2)).toLocaleString('es-AR')

// ───────────── Asistencia de la semana, alumno por alumno ─────────────

export type WeekCell = 'trained' | 'missed' | 'due' | 'owed' | 'none' | 'future'

export interface WeekMatrixRow {
  routineId: string
  studentId: string
  studentName: string
  avatarPath: string | null
  /** De lunes a domingo. */
  cells: WeekCell[]
  trainedDays: number
}

/**
 * Una fila por alumno y una celda por día de la semana en curso: entrenó, avisó que no, le toca hoy,
 * lo debe (tenía ese día asignado y no lo registró) o nada.
 */
export function weekMatrix(opts: { routines: MonitorRoutine[]; setLogs: MonitorSetLog[]; dayLogs: MonitorDayLog[]; now: Date }): WeekMatrixRow[] {
  const today = ymdLocal(opts.now)
  const monday = new Date(opts.now.getFullYear(), opts.now.getMonth(), opts.now.getDate() - mondayIndex(opts.now.getDay()))
  const week = Array.from({ length: 7 }, (_, i) => ymdLocal(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)))
  const dayLogById = new Map(opts.dayLogs.map((d) => [d.routine_day_id, d]))
  const logDatesByExercise = new Map<string, Set<string>>()
  for (const l of opts.setLogs) {
    if (l.completed === false) continue
    const ymd = ymdLocal(new Date(l.updated_at))
    const set = logDatesByExercise.get(l.routine_exercise_id)
    if (set) set.add(ymd)
    else logDatesByExercise.set(l.routine_exercise_id, new Set([ymd]))
  }

  return opts.routines
    .map((r): WeekMatrixRow => {
      const trained = new Set<string>()
      const missed = new Set<string>()
      for (const b of r.blocks)
        for (const d of b.days) {
          for (const ex of d.exercises) for (const ymd of logDatesByExercise.get(ex.id) ?? []) trained.add(ymd)
          const log = dayLogById.get(d.id)
          if (log?.status && log.status_date) (log.status === 'done' ? trained : missed).add(log.status_date)
        }
      // Días asignados de la semana en curso (según el día de la semana que cargó el entrenador).
      const blocks = [...r.blocks].sort((a, b) => a.sort_order - b.sort_order)
      const assigned = new Set((blocks[currentBlockIndex(blocks, today)]?.days ?? []).filter((d) => d.day_of_week != null).map((d) => mondayIndex(d.day_of_week!)))
      const cells = week.map((ymd, i): WeekCell => {
        if (trained.has(ymd)) return 'trained'
        if (missed.has(ymd)) return 'missed'
        if (ymd > today) return 'future'
        if (assigned.has(i)) return ymd === today ? 'due' : 'owed'
        return 'none'
      })
      return { routineId: r.id, studentId: r.student_id, studentName: r.student_name, avatarPath: r.avatar_path, cells, trainedDays: cells.filter((x) => x === 'trained').length }
    })
    .sort((a, b) => b.trainedDays - a.trainedDays || a.studentName.localeCompare(b.studentName, 'es'))
}

// ───────────── Datos ─────────────

type RoutineRow = {
  id: string
  student_id: string | null
  student: { full_name: string; avatar_path: string | null } | null
  blocks: MonitorBlock[] | null
}

export interface RoutineCandidate {
  id: string
  student_id: string
  status: string
  start_date: string | null
  created_at: string
  /** Estado del alumno («activo», «inactivo»…). */
  student_status: string | null
}

/**
 * Qué rutina mira el monitor por cada alumno: la misma que muestra su link (`get_shared_routine`), o sea
 * la activa o por vencer más reciente. Si la que muestra el link no está activa (pausada, cancelada,
 * terminada), el link avisa que no hay rutina activa y no deja anotar, así que acá tampoco entra: coincide
 * con «Sin rutina activa» de Alumnos.
 */
export function pickMonitorRoutines(candidates: RoutineCandidate[]): string[] {
  const live = (s: string) => s === 'activa' || s === 'por_vencer'
  const byStudent = new Map<string, RoutineCandidate[]>()
  for (const c of candidates) {
    const list = byStudent.get(c.student_id)
    if (list) list.push(c)
    else byStudent.set(c.student_id, [c])
  }
  const out: string[] = []
  for (const list of byStudent.values()) {
    const [pick] = [...list].sort(
      (a, b) =>
        Number(live(b.status)) - Number(live(a.status)) ||
        Number(b.status !== 'completada') - Number(a.status !== 'completada') ||
        (b.start_date ?? '').localeCompare(a.start_date ?? '') ||
        b.created_at.localeCompare(a.created_at),
    )
    if (pick && live(pick.status)) out.push(pick.id)
  }
  return out
}

/** Rutinas que miran los alumnos, con su estructura (semanas, días, ejercicios). Cambia poco: se pide de vez en cuando. */
export async function loadMonitorRoutines(ownerId: string): Promise<MonitorRoutine[]> {
  // Primero, liviano: todas las rutinas con alumno, para elegir la que ve cada uno.
  const cands = await supabase
    .from('routines')
    .select('id, student_id, status, start_date, created_at, student:students(status)')
    .eq('owner_id', ownerId)
    .not('student_id', 'is', null)
    .range(0, 4999)
  if (cands.error || !cands.data) return []
  const ids = pickMonitorRoutines(
    (cands.data as unknown as (Omit<RoutineCandidate, 'student_status'> & { student: { status: string | null } | null })[]).map((c) => ({
      id: c.id,
      student_id: c.student_id,
      status: c.status,
      start_date: c.start_date,
      created_at: c.created_at,
      student_status: c.student?.status ?? null,
    })),
  )
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('routines')
    .select(
      'id, student_id, student:students(full_name, avatar_path), blocks:routine_blocks(id, sort_order, start_date, end_date, days:routine_days(id, day_name, muscle_focus, sort_order, day_of_week, exercises:routine_exercises(id, exercise_id, sets, weight_kg, rest_seconds, sort_order, exercise:exercise_library(name))))',
    )
    .in('id', ids)
  if (error || !data) return []
  return (data as unknown as RoutineRow[])
    .filter((r) => r.student_id && r.student)
    .map((r) => ({
      id: r.id,
      student_id: r.student_id!,
      student_name: r.student!.full_name,
      avatar_path: r.student!.avatar_path,
      blocks: (r.blocks ?? []).map((b) => ({
        ...b,
        days: (b.days ?? []).map((d) => ({
          ...d,
          exercises: [...(d.exercises ?? [])]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((ex) => {
              const { exercise, ...rest } = ex as MonitorExercise & { exercise?: { name: string | null } | null }
              return { ...rest, name: exercise?.name ?? rest.name ?? null }
            }),
        })),
      })),
    }))
}

/** Lo anotado por los alumnos en esas rutinas. Sin las tablas (faltan las migraciones) devuelve vacío. */
export async function loadMonitorLogs(routineIds: string[]): Promise<{ setLogs: MonitorSetLog[]; dayLogs: MonitorDayLog[]; feedback: MonitorFeedback[] }> {
  if (routineIds.length === 0) return { setLogs: [], dayLogs: [], feedback: [] }
  const since = new Date(Date.now() - MONITOR_LOOKBACK_DAYS * 86_400_000).toISOString()
  // Solo interesa lo de hoy: desde la medianoche local.
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const [setLogs, dayLogs, feedback] = await Promise.all([
    fetchAllPages<MonitorSetLog>((from, to) =>
      supabase
        .from('routine_exercise_logs')
        .select('routine_exercise_id, set_number, weight_kg, reps, completed, updated_at')
        .in('routine_id', routineIds)
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .range(from, to),
    ),
    fetchAllPages<MonitorDayLog>((from, to) =>
      supabase
        .from('routine_day_logs')
        .select('routine_day_id, status, status_date, missed_reason, updated_at, sleep, energy, stress, soreness, checkin_note, checkin_at, effort')
        .in('routine_id', routineIds)
        .order('routine_day_id')
        .range(from, to),
    ),
    fetchAllPages<MonitorFeedback>((from, to) =>
      supabase
        .from('routine_exercise_feedback')
        .select('routine_exercise_id, note, effort, updated_at')
        .in('routine_id', routineIds)
        .gte('updated_at', midnight)
        .order('routine_exercise_id')
        .range(from, to),
    ),
  ])
  return { setLogs, dayLogs, feedback }
}

/** Días hacia atrás que mira el monitor: hoy, la semana en curso y la anterior (para comparar cargas). */
export const MONITOR_LOOKBACK_DAYS = 21
const PAGE = 1000

/**
 * Trae todas las filas de una consulta, de a páginas. La API corta cada respuesta en 1000 filas aunque
 * se pida más: sin esto, pasado ese tope los datos más nuevos quedan afuera sin avisar.
 */
export async function fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>, maxPages = 20): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await page(i * PAGE, i * PAGE + PAGE - 1)
    const rows = (error ? [] : ((data as T[] | null) ?? []))
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

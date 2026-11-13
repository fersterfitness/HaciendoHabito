import { supabase } from '@/lib/supabase'
import { currentBlockIndex } from '@/lib/routine/sharedRoutine'
import type { DayStatus } from '@/lib/routine/studentTrainingLog'

/**
 * Semana de entrenamiento del alumno (feedback del entrenador, nov-2026): cuándo se habilita el
 * formulario semanal, cómo cerró la semana y qué avisos le corresponden al entrenador.
 * Todo se calcula con lo que el alumno deja desde su link (`routine_day_logs`, kilos anotados) y
 * con el formulario semanal; no guarda nada.
 */

// ───────────── Lado del alumno ─────────────

/** Viernes, sábado o domingo: los días en que se responde el formulario de la semana. */
export function isFeedbackWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 5 || d === 6 || d === 0
}

export type WeekClose = {
  total: number
  done: number
  missed: number
  /** Días que todavía no cerró (ni terminados ni marcados como no entrenados). */
  open: number
}

export function weekClose(dayIds: string[], statusOf: (dayId: string) => DayStatus | null | undefined): WeekClose {
  let done = 0
  let missed = 0
  for (const id of dayIds) {
    const s = statusOf(id)
    if (s === 'done') done += 1
    else if (s === 'missed') missed += 1
  }
  return { total: dayIds.length, done, missed, open: dayIds.length - done - missed }
}

/**
 * El formulario semanal se habilita viernes, sábado y domingo, o antes si el alumno ya está en su
 * último día de entrenamiento de la semana (le queda uno solo por cerrar, o ninguno).
 */
export function feedbackWindowOpen(date: Date, week: WeekClose): boolean {
  if (isFeedbackWeekend(date)) return true
  return week.total > 0 && week.open <= 1
}

export const HABIT_PHRASE = 'A seguir haciéndolo hábito.'

/** Mensaje de cierre de semana para el alumno; `null` si todavía le quedan días o el formulario. */
export function weekCloseMessage(week: WeekClose, opts: { feedbackDone: boolean; isLastWeek: boolean }): { title: string; body: string } | null {
  if (week.total === 0 || week.open > 0 || !opts.feedbackDone) return null
  if (opts.isLastWeek) {
    return {
      title: '¡Terminaste tu mes de rutina!',
      body:
        week.missed === 0
          ? `Cerraste la última semana con todo completo. Gran trabajo este mes. ${HABIT_PHRASE}`
          : `Cerraste la última semana. No todo sale siempre como lo planeamos, y llegaste igual hasta el final. ${HABIT_PHRASE}`,
    }
  }
  if (week.missed === 0) {
    return { title: '¡Semana completa!', body: `Hiciste todos tus entrenamientos y dejaste el formulario. Felicitaciones por el trabajo de esta semana. ${HABIT_PHRASE}` }
  }
  return {
    title: 'Semana cerrada',
    body: `A veces no todo sale como esperamos, y está bien. Lo importante es volver la semana que viene y seguir haciéndolo hábito.`,
  }
}

// ───────────── Lado del entrenador ─────────────

export type WeekAlertKind = 'month_done' | 'last_week' | 'week_done' | 'no_record'

export interface WeekAlert {
  /** Estable por rutina y semana: sirve para marcarlo como visto. */
  key: string
  kind: WeekAlertKind
  routineId: string
  studentId: string
  studentName: string
  studentPhone: string | null
  title: string
  detail: string
  /** Mensaje sugerido para mandarle por WhatsApp. */
  whatsapp: string
}

export interface AlertRoutine {
  id: string
  studentId: string
  studentName: string
  studentPhone: string | null
  blocks: { id: string; name: string | null; start_date: string | null; end_date: string | null; dayIds: string[]; loggedSets: number }[]
}

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? ''

/**
 * Avisos de la semana en curso de cada rutina activa.
 * - Semana terminada (todos los días cerrados + formulario): según cuál sea, «terminó la semana»,
 *   «entra en su última semana» (cerró la anteúltima) o «terminó su mes».
 * - Sábado o domingo sin ningún día cerrado, sin kilos anotados y sin formulario: «no registró nada».
 */
export function buildWeekAlerts(input: {
  routines: AlertRoutine[]
  statusOf: (dayId: string) => DayStatus | null | undefined
  /** Alumnos que todavía no respondieron el formulario de esta semana. */
  missingForm: Set<string>
  today: Date
  todayYmd: string
}): WeekAlert[] {
  const out: WeekAlert[] = []
  const weekday = input.today.getDay()
  for (const r of input.routines) {
    if (r.blocks.length === 0) continue
    const i = currentBlockIndex(r.blocks, input.todayYmd)
    const block = r.blocks[i]!
    if (block.dayIds.length === 0) continue
    const week = weekClose(block.dayIds, input.statusOf)
    const formDone = !input.missingForm.has(r.studentId)
    const base = { routineId: r.id, studentId: r.studentId, studentName: r.studentName, studentPhone: r.studentPhone }
    const hi = firstName(r.studentName) ? `Hola ${firstName(r.studentName)}!` : 'Hola!'
    const weekLabel = block.name?.trim() || `semana ${i + 1}`
    const missedText = week.missed ? ` ${week.missed === 1 ? 'Faltó 1 día' : `Faltó ${week.missed} días`}.` : ''

    if (week.open === 0 && formDone) {
      const isLast = i === r.blocks.length - 1
      const isPenultimate = i === r.blocks.length - 2
      const kind: WeekAlertKind = isLast ? 'month_done' : isPenultimate ? 'last_week' : 'week_done'
      out.push({
        ...base,
        key: `${kind}:${r.id}:${block.id}`,
        kind,
        title: isLast
          ? `${r.studentName} terminó su mes de rutina`
          : isPenultimate
            ? `${r.studentName} entra en su última semana`
            : `${r.studentName} terminó la ${weekLabel.toLowerCase()}`,
        detail: `${isPenultimate ? `Cerró la ${weekLabel.toLowerCase()} y completó el formulario.` : 'Cerró todos los días y completó el formulario.'}${missedText} Revisá lo que registró.`,
        whatsapp: isLast
          ? `${hi} Vi que cerraste tu mes de rutina. Gran trabajo. Reviso todo y te armo lo que sigue. ${HABIT_PHRASE}`
          : week.missed === 0
            ? `${hi} Vi que completaste todos los entrenamientos de la semana y el formulario. Muy buen trabajo. ${HABIT_PHRASE}`
            : `${hi} Vi tu semana y el formulario. No siempre sale todo como lo planeamos; lo importante es seguir. ${HABIT_PHRASE}`,
      })
      continue
    }

    const weekend = weekday === 6 || weekday === 0
    if (weekend && week.done + week.missed === 0 && block.loggedSets === 0 && !formDone) {
      out.push({
        ...base,
        key: `no_record:${r.id}:${block.id}`,
        kind: 'no_record',
        title: `${r.studentName} no registró nada esta semana`,
        detail: 'No cerró ningún día, no anotó pesos y no completó el formulario.',
        whatsapp: `${hi} Recordá registrar tus pesos y completar el formulario de la semana antes del lunes. Con eso ajusto tu rutina.`,
      })
    }
  }
  const order: Record<WeekAlertKind, number> = { month_done: 0, last_week: 1, week_done: 2, no_record: 3 }
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.studentName.localeCompare(b.studentName, 'es'))
}

type RawRoutine = {
  id: string
  student_id: string
  student: { full_name?: string | null; phone?: string | null } | { full_name?: string | null; phone?: string | null }[] | null
  blocks: { id: string; name: string | null; sort_order: number; start_date: string | null; end_date: string | null; days: { id: string; exercises: { id: string }[] | null }[] | null }[] | null
}

/**
 * Rutinas activas del entrenador con lo que cada alumno registró. Devuelve `null` si todavía no
 * está la tabla de cierres de día (falta 20261115120000_student_training_log.sql): sin eso no hay avisos.
 */
export async function loadWeekAlertData(ownerId: string): Promise<{ routines: AlertRoutine[]; status: Map<string, DayStatus | null> } | null> {
  const { data, error } = await supabase
    .from('routines')
    .select(
      'id, student_id, student:students(full_name, phone), blocks:routine_blocks(id, name, sort_order, start_date, end_date, days:routine_days(id, exercises:routine_exercises(id)))',
    )
    .eq('owner_id', ownerId)
    .in('status', ['activa', 'por_vencer'])
    .not('student_id', 'is', null)
  if (error || !data) return null
  const raw = data as unknown as RawRoutine[]
  const ids = raw.map((r) => r.id)
  if (ids.length === 0) return { routines: [], status: new Map() }

  const [dayLogs, setLogs] = await Promise.all([
    supabase.from('routine_day_logs').select('routine_day_id, status').in('routine_id', ids),
    supabase.from('routine_exercise_logs').select('routine_exercise_id').in('routine_id', ids),
  ])
  if (dayLogs.error) return null

  const status = new Map<string, DayStatus | null>()
  for (const l of (dayLogs.data ?? []) as { routine_day_id: string; status: DayStatus | null }[]) status.set(l.routine_day_id, l.status)
  const setsByExercise = new Map<string, number>()
  for (const l of (setLogs.data ?? []) as { routine_exercise_id: string }[]) setsByExercise.set(l.routine_exercise_id, (setsByExercise.get(l.routine_exercise_id) ?? 0) + 1)

  const routines: AlertRoutine[] = raw.map((r) => {
    const s = Array.isArray(r.student) ? r.student[0] : r.student
    return {
      id: r.id,
      studentId: r.student_id,
      studentName: s?.full_name ?? 'Alumno',
      studentPhone: s?.phone ?? null,
      blocks: [...(r.blocks ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((b) => ({
          id: b.id,
          name: b.name,
          start_date: b.start_date,
          end_date: b.end_date,
          dayIds: (b.days ?? []).map((d) => d.id),
          loggedSets: (b.days ?? []).reduce((n, d) => n + (d.exercises ?? []).reduce((m, e) => m + (setsByExercise.get(e.id) ?? 0), 0), 0),
        })),
    }
  })
  return { routines, status }
}

// ── Avisos ya vistos (en este navegador) ──

const DISMISSED_KEY = 'hh-week-alerts-seen'

export function readDismissedAlerts(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function dismissAlert(key: string): string[] {
  // Se guardan los últimos 400: las claves viejas (semanas pasadas) no vuelven a aparecer igual.
  const next = [...readDismissedAlerts().filter((k) => k !== key), key].slice(-400)
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
  } catch {
    /* sin storage: vuelve a aparecer al recargar */
  }
  return next
}

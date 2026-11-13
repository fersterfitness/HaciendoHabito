import { supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import type { SharedRoutineBlock } from '@/lib/routine/sharedRoutine'
import { CHECKIN_SCALES, type TrainingExtras } from '@/lib/routine/studentTrainingLog'

/**
 * App del alumno, tanda 4 (20261116120000_student_app_extras.sql): progreso, ciclo menstrual,
 * devolución de fin de mes y recordatorio del día de pago.
 */

export interface StudentExtras {
  /** Fecha de hoy según el servidor (yyyy-MM-dd). */
  today: string
  /** Inicios de ciclo, del más nuevo al más viejo. */
  cycles: string[]
  on_pill: boolean
  reviewed_days: string[]
  payment: { day_from: number | null; day_to: number | null; paid_this_month: boolean }
}

/** `null`: todavía no está activado en la base (o falló): la página no muestra nada de esto. */
export async function fetchSharedStudentExtras(token: string): Promise<StudentExtras | null> {
  try {
    const { data, error } = await supabasePublic.rpc('get_shared_student_extras', { p_token: token })
    if (error || data == null) return null
    const d = data as Partial<StudentExtras>
    return {
      today: d.today ?? new Date().toISOString().slice(0, 10),
      cycles: d.cycles ?? [],
      on_pill: !!d.on_pill,
      reviewed_days: d.reviewed_days ?? [],
      payment: { day_from: d.payment?.day_from ?? null, day_to: d.payment?.day_to ?? null, paid_this_month: !!d.payment?.paid_this_month },
    }
  } catch {
    return null
  }
}

async function call(fn: string, args: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabasePublic.rpc(fn, args)
  if (error || !(data as { ok?: boolean } | null)?.ok) throw new Error('No se pudo guardar. Intentá de nuevo.')
}

export const saveSharedMonthReview = (token: string, dayId: string, r: { review: string; rating: number | null; shareOk: boolean }) =>
  call('save_shared_month_review', { p_token: token, p_day_id: dayId, p_review: r.review, p_rating: r.rating, p_share_ok: r.shareOk })
export const saveSharedCycleStart = (token: string, date: string) => call('save_shared_cycle_start', { p_token: token, p_date: date })
export const saveSharedCyclePill = (token: string, onPill: boolean) => call('save_shared_cycle_pill', { p_token: token, p_on_pill: onPill })

// ───────────── Día de pago ─────────────

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Días hábiles (lunes a viernes) entre dos fechas, sin contar la primera. */
export function businessDaysBetween(fromYmd: string, toYmd: string): number {
  const from = new Date(`${fromYmd}T12:00:00`)
  const to = new Date(`${toYmd}T12:00:00`)
  let n = 0
  for (const d = new Date(from); d < to; ) {
    d.setDate(d.getDate() + 1)
    const w = d.getDay()
    if (w !== 0 && w !== 6) n += 1
  }
  return n
}

export type PaymentNotice = { level: 'due' | 'late'; title: string; body: string }

/**
 * Recordatorio de pago para el alumno. «due»: está dentro de su ventana de pago del mes.
 * «late»: pasaron más de 5 días hábiles del último día y no hay cobro registrado este mes.
 * Sin ventana cargada o con un cobro del mes, no hay aviso.
 */
export function paymentNotice(p: StudentExtras['payment'], todayYmd: string): PaymentNotice | null {
  if (p.paid_this_month) return null
  const last = p.day_to ?? p.day_from
  const first = p.day_from ?? p.day_to
  if (last == null || first == null) return null
  const today = new Date(`${todayYmd}T12:00:00`)
  const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const day = today.getDate()
  const lo = Math.min(first, dim)
  const hi = Math.min(Math.max(first, last), dim)
  if (day >= lo && day <= hi) {
    return {
      level: 'due',
      title: lo === hi ? 'Hoy es tu fecha de pago' : 'Estás en tu fecha de pago',
      body: 'Es solo un recordatorio. Si ya lo hiciste, no hace falta que hagas nada.',
    }
  }
  if (day > hi) {
    const due = ymd(new Date(today.getFullYear(), today.getMonth(), hi))
    if (businessDaysBetween(due, todayYmd) > 5) {
      return {
        level: 'late',
        title: 'Tu pago de este mes todavía figura pendiente',
        body: `Tu fecha era el ${hi}. Si ya lo hiciste, avisale a tu entrenador para que lo registre.`,
      }
    }
  }
  return null
}

// ───────────── Ciclo ─────────────

/** Día del ciclo en curso (1 = primer día de menstruación) o `null` si no hay registros o es viejo. */
export function cycleDay(cycles: string[], todayYmd: string): number | null {
  const last = cycles[0]
  if (!last) return null
  const days = Math.round((new Date(`${todayYmd}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86_400_000)
  return days >= 0 && days <= 60 ? days + 1 : null
}

/** Etapa orientativa para un ciclo de 28 días. */
export function cyclePhase(day: number): string {
  if (day <= 5) return 'Menstruación'
  if (day <= 13) return 'Fase folicular'
  if (day <= 16) return 'Ovulación'
  if (day <= 28) return 'Fase lútea'
  return 'Ciclo largo: registrá el nuevo inicio cuando llegue'
}

// ───────────── Progreso ─────────────

export interface WeekProgress {
  label: string
  total: number
  done: number
  missed: number
  /** Promedios del chequeo previo (1 a 5) de los días con registro; `null` si no hubo. */
  averages: Record<'sleep' | 'energy' | 'stress' | 'soreness', number | null>
  /** Esfuerzo promedio de las sesiones (Borg 1-10). */
  effort: number | null
}

export interface LiftProgress {
  name: string
  firstKg: number
  lastKg: number
  firstLabel: string
  lastLabel: string
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

/** Resumen por semana de la rutina: días cerrados y cómo llegó el alumno a entrenar. */
export function weeklyProgress(blocks: SharedRoutineBlock[], extras: TrainingExtras): WeekProgress[] {
  return blocks.map((b, i) => {
    const logs = b.days.map((d) => extras.days[d.id]).filter((l): l is NonNullable<typeof l> => !!l)
    const averages = Object.fromEntries(
      CHECKIN_SCALES.map((s) => [s.key, avg(logs.map((l) => l[s.key]).filter((v): v is number => v != null))]),
    ) as WeekProgress['averages']
    return {
      label: b.name?.trim() || `Semana ${i + 1}`,
      total: b.days.length,
      done: logs.filter((l) => l.status === 'done').length,
      missed: logs.filter((l) => l.status === 'missed').length,
      averages,
      effort: avg(logs.map((l) => l.effort).filter((v): v is number => v != null)),
    }
  })
}

/**
 * Ejercicios que el alumno cargó con kilos en más de una semana: el mejor peso de la primera
 * semana en que lo anotó contra el de la última. Los que más subieron primero.
 */
export function liftProgress(blocks: SharedRoutineBlock[], kgOf: (exerciseId: string) => number[], limit = 5): LiftProgress[] {
  const byName = new Map<string, { name: string; weeks: { label: string; kg: number }[] }>()
  blocks.forEach((b, i) => {
    const best = new Map<string, { name: string; kg: number }>()
    for (const d of b.days)
      for (const ex of d.exercises) {
        if (!ex.name) continue
        const kgs = kgOf(ex.id).filter((k) => k > 0)
        if (!kgs.length) continue
        const key = norm(ex.name)
        const top = Math.max(...kgs)
        if (!best.has(key) || best.get(key)!.kg < top) best.set(key, { name: ex.name, kg: top })
      }
    for (const [key, v] of best) {
      const entry = byName.get(key) ?? { name: v.name, weeks: [] }
      entry.weeks.push({ label: b.name?.trim() || `Semana ${i + 1}`, kg: v.kg })
      byName.set(key, entry)
    }
  })
  return [...byName.values()]
    .filter((e) => e.weeks.length >= 2)
    .map((e) => {
      const first = e.weeks[0]!
      const last = e.weeks[e.weeks.length - 1]!
      return { name: e.name, firstKg: first.kg, lastKg: last.kg, firstLabel: first.label, lastLabel: last.label }
    })
    .sort((a, b) => b.lastKg - b.firstKg - (a.lastKg - a.firstKg))
    .slice(0, limit)
}

// ───────────── Lado del entrenador ─────────────

export interface MonthReview {
  routine_id: string
  student_id: string
  student_name: string
  routine_name: string
  review: string
  rating: number | null
  share_ok: boolean
  created_at: string
}

/** Devoluciones de fin de mes de los últimos 90 días. Sin la migración devuelve vacío. */
export async function fetchRecentMonthReviews(ownerId: string): Promise<MonthReview[]> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('routine_month_reviews')
    .select('routine_id, student_id, review, rating, share_ok, created_at, student:students(full_name), routine:routines(name)')
    .eq('owner_id', ownerId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error || !data) return []
  type One<T> = T | T[] | null
  const one = <T,>(x: One<T>): T | null => (Array.isArray(x) ? (x[0] ?? null) : x)
  return (data as unknown as (Omit<MonthReview, 'student_name' | 'routine_name'> & { student: One<{ full_name?: string | null }>; routine: One<{ name?: string | null }> })[]).map(
    ({ student, routine, ...r }) => ({ ...r, student_name: one(student)?.full_name ?? 'Alumno', routine_name: one(routine)?.name ?? '' }),
  )
}

/** Si la alumna indicó que toma pastillas (para la ficha del entrenador). */
export async function fetchCycleOnPill(studentId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('student_cycle_settings').select('on_pill').eq('student_id', studentId).maybeSingle()
  if (error) return null
  return data ? !!(data as { on_pill: boolean }).on_pill : null
}

import { createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'

/**
 * Lo que el alumno deja desde el link de su rutina además de kilos y repeticiones
 * (20261115120000_student_training_log.sql): nota y esfuerzo por ejercicio, chequeo de antes de
 * entrenar, cierre de cada día (terminado / no entrenado) y consultas urgentes.
 */

export const TRAINING_LOG_MIGRATION = '20261115120000_student_training_log.sql'

export interface ExerciseFeedback {
  note: string
  /** Escala de Borg: 1 (muy suave) a 10 (máximo). */
  effort: number | null
}

export type DayStatus = 'done' | 'missed'

export interface DayLog {
  sleep: number | null
  energy: number | null
  stress: number | null
  soreness: number | null
  checkin_note: string
  checkin_at: string | null
  status: DayStatus | null
  /** Fecha en que lo marcó (yyyy-MM-dd). */
  status_date: string | null
  missed_reason: string
  effort: number | null
  // Chequeo diario nuevo (20261120120000_daily_checkin_v2.sql). Ver dailyCheckin.ts.
  sleep_hours?: string | null
  pain_kind?: string | null
  pain_areas?: string[]
  pain_note?: string
  hydration?: number | null
  motivation?: number | null
  recovery?: number | null
  nutrition?: number | null
  nutrition_issue?: string | null
  nutrition_issue_note?: string
  steps_avg?: string | null
  cycle_answer?: string | null
}

export const EMPTY_DAY_LOG: DayLog = {
  sleep: null,
  energy: null,
  stress: null,
  soreness: null,
  checkin_note: '',
  checkin_at: null,
  status: null,
  status_date: null,
  missed_reason: '',
  effort: null,
}

/** Avisos que el alumno manda con un botón (20261121120000_student_routine_notices.sql). */
export type RoutineNoticeKind = 'last_week' | 'week_done' | 'routine_done'
export interface RoutineNoticeSent {
  block_id: string
  kind: RoutineNoticeKind
}

export interface TrainingExtras {
  exercises: Record<string, ExerciseFeedback>
  days: Record<string, DayLog>
  /** Solo en el link del alumno. Sin la migración, vacío. */
  notices?: RoutineNoticeSent[]
  /**
   * Notas que el alumno se deja a sí mismo, por ejercicio (clave: `exerciseNoteKey(nombre)`).
   * Indefinido sin la migración 20261122120000_student_exercise_self_notes.sql.
   */
  selfNotes?: Record<string, string>
  /**
   * Feedback nov19 (tanda 3): series que el alumno anotó «por lado», por ejercicio y número de serie.
   * Indefinido sin la migración 20261124120000_peso_por_lado.sql (el selector total / por lado no se muestra).
   */
  setModes?: Record<string, Record<number, SetWeightMode>>
  /**
   * Feedback nov19 (tanda 4): notas del entrenador que el alumno todavía no ocultó, por `exerciseNoteKey(nombre)`.
   * Indefinido sin la migración 20261125120000_notas_para_el_alumno.sql.
   */
  coachNotes?: Record<string, { note: string; updated_at: string }>
  /**
   * Feedback nov24 (tanda 2): notas por ejercicio de la semana (`exercise_id`) o por circuito (`day_id` + grupo),
   * con «Lo vi». Indefinido sin la migración 20261127130000_notas_por_semana_y_circuito.sql.
   */
  coachNoteItems?: SharedCoachNote[]
}

export interface SharedCoachNote {
  id: string
  exercise_id: string | null
  day_id: string | null
  circuit_group: number | null
  note: string
  created_at: string
  seen_at: string | null
}

/** Cómo anotó el alumno los kilos de una serie. */
export type SetWeightMode = 'total' | 'lado'

/** Escala de Borg modificada (1 a 10), en palabras para el alumno. */
export const BORG_LABELS: Record<number, string> = {
  1: 'Muy, muy suave',
  2: 'Muy suave',
  3: 'Suave',
  4: 'Moderado',
  5: 'Algo duro',
  6: 'Duro',
  7: 'Muy duro',
  8: 'Muy, muy duro',
  9: 'Casi al máximo',
  10: 'Máximo',
}

/** Preguntas del chequeo de antes de entrenar (1 a 5). En todas, más alto es «más». */
export const CHECKIN_SCALES: { key: 'sleep' | 'energy' | 'stress' | 'soreness'; label: string; low: string; high: string; short: string }[] = [
  { key: 'sleep', label: '¿Cómo dormiste?', low: 'Muy mal', high: 'Muy bien', short: 'Sueño' },
  { key: 'energy', label: '¿Cómo estás de energía?', low: 'Sin energía', high: 'Con todo', short: 'Energía' },
  { key: 'stress', label: '¿Cuánto estrés tenés hoy?', low: 'Nada', high: 'Muchísimo', short: 'Estrés' },
  { key: 'soreness', label: '¿Tenés dolores o molestias?', low: 'Ninguna', high: 'Muchas', short: 'Molestias' },
]

export function hasCheckin(log: DayLog | undefined): boolean {
  return !!log && (log.checkin_at != null || log.sleep != null || log.energy != null || log.stress != null || log.soreness != null)
}

/** «Sueño 4/5 · Energía 3/5 · Estrés 2/5 · Molestias 1/5». */
export function checkinSummary(log: DayLog): string {
  return CHECKIN_SCALES.filter((s) => log[s.key] != null)
    .map((s) => `${s.short} ${log[s.key]}/5`)
    .join(' · ')
}

type RawExtras = {
  exercises?: { exercise_id: string; note: string | null; effort: number | null }[]
  days?: ({ day_id: string } & Partial<DayLog>)[]
  notices?: RoutineNoticeSent[]
  self_notes?: Record<string, string>
  set_modes?: { exercise_id: string; set: number; mode: SetWeightMode | null }[]
  coach_notes?: Record<string, { note: string; updated_at: string }>
  coach_note_items?: SharedCoachNote[]
}

function toExtras(raw: RawExtras | null): TrainingExtras {
  const out: TrainingExtras = { exercises: {}, days: {}, notices: raw?.notices, selfNotes: raw?.self_notes, coachNotes: raw?.coach_notes, coachNoteItems: raw?.coach_note_items }
  if (raw?.set_modes) {
    out.setModes = {}
    for (const m of raw.set_modes) if (m.mode) (out.setModes[m.exercise_id] ??= {})[m.set] = m.mode
  }
  for (const e of raw?.exercises ?? []) out.exercises[e.exercise_id] = { note: e.note ?? '', effort: e.effort ?? null }
  for (const d of raw?.days ?? []) {
    const { day_id, ...rest } = d
    out.days[day_id] = { ...EMPTY_DAY_LOG, ...rest, checkin_note: rest.checkin_note ?? '', missed_reason: rest.missed_reason ?? '' }
  }
  return out
}

const missingFunction = (error: { code?: string; message?: string } | null) => error?.code === 'PGRST202' || error?.code === '42883'

/**
 * Lo que el alumno ya dejó. `null` si todavía no se corrió la migración: la página sigue andando
 * como antes y no muestra lo nuevo.
 */
export async function fetchSharedExtras(token: string): Promise<TrainingExtras | null> {
  try {
    const { data, error } = await supabasePublic.rpc('get_shared_routine_extras', { p_token: token })
    // Con cualquier error lo nuevo queda apagado: es preferible a mostrar algo que no se va a guardar.
    if (error || data == null) return null
    return toExtras(data as RawExtras)
  } catch {
    return null
  }
}

export async function call(fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabasePublic.rpc(fn, args)
  if (error) throw new Error(missingFunction(error) ? 'Esto todavía no está activado. Avisale a tu entrenador.' : 'No se pudo guardar. Intentá de nuevo.')
  const res = (data ?? {}) as { ok?: boolean; error?: string }
  if (!res.ok) throw new Error(res.error === 'too_many' ? 'Ya mandaste varias consultas hoy. Escribile por WhatsApp.' : 'No se pudo guardar. Intentá de nuevo.')
  return res
}

/**
 * Clave de la nota propia: el nombre del ejercicio en minúsculas y con espacios simples, así la nota
 * sigue apareciendo en las otras semanas y rutinas que repiten el ejercicio.
 */
export function exerciseNoteKey(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 160)
}

export async function saveSharedExerciseSelfNote(token: string, key: string, note: string): Promise<void> {
  await call('save_shared_exercise_self_note', { p_token: token, p_exercise_key: key, p_note: note })
}

export async function sendSharedRoutineNotice(token: string, blockId: string, kind: RoutineNoticeKind): Promise<void> {
  await call('send_shared_routine_notice', { p_token: token, p_block_id: blockId, p_kind: kind })
}

/** Qué ve el entrenador como título de cada aviso. */
export function urgentTitle(m: Pick<UrgentMessage, 'kind' | 'student_name'>): string {
  const first = m.student_name.trim().split(/\s+/)[0] || 'Tu alumno'
  switch (m.kind) {
    case 'pain':
      return `${first} tiene un dolor puntual`
    case 'last_week':
      return `${first} está en su última semana`
    case 'week_done':
      return `${first} terminó su semana`
    case 'routine_done':
      return `${first} terminó su rutina`
    default:
      return `Consulta urgente de ${first}`
  }
}

export async function saveSharedExerciseFeedback(token: string, exerciseId: string, fb: ExerciseFeedback): Promise<void> {
  await call('save_shared_exercise_feedback', { p_token: token, p_exercise_id: exerciseId, p_note: fb.note, p_effort: fb.effort })
}

export async function saveSharedDayCheckin(
  token: string,
  dayId: string,
  c: Pick<DayLog, 'sleep' | 'energy' | 'stress' | 'soreness' | 'checkin_note'>,
): Promise<void> {
  await call('save_shared_day_checkin', {
    p_token: token,
    p_day_id: dayId,
    p_sleep: c.sleep,
    p_energy: c.energy,
    p_stress: c.stress,
    p_soreness: c.soreness,
    p_note: c.checkin_note,
  })
}

/** `status: null` deshace el cierre. `date` es la fecha del celular del alumno (yyyy-MM-dd). */
export async function saveSharedDayStatus(
  token: string,
  dayId: string,
  s: { status: DayStatus | null; reason?: string; effort?: number | null; date: string },
): Promise<void> {
  await call('save_shared_day_status', {
    p_token: token,
    p_day_id: dayId,
    p_status: s.status,
    p_reason: s.reason ?? '',
    p_effort: s.effort ?? null,
    p_date: s.date,
  })
}

export async function sendSharedUrgentMessage(token: string, message: string): Promise<void> {
  await call('send_shared_urgent_message', { p_token: token, p_message: message })
}

// ───────────── Lado del entrenador ─────────────

/** Notas, esfuerzos y cierres de una rutina. Sin la migración devuelve vacío. */
export async function fetchRoutineTrainingExtras(routineId: string): Promise<TrainingExtras> {
  const out: TrainingExtras = { exercises: {}, days: {} }
  const [fb, days] = await Promise.all([
    supabase.from('routine_exercise_feedback').select('routine_exercise_id, note, effort').eq('routine_id', routineId),
    supabase.from('routine_day_logs').select('*').eq('routine_id', routineId),
  ])
  for (const r of (fb.data ?? []) as { routine_exercise_id: string; note: string | null; effort: number | null }[])
    out.exercises[r.routine_exercise_id] = { note: r.note ?? '', effort: r.effort ?? null }
  for (const r of (days.data ?? []) as ({ routine_day_id: string } & Partial<DayLog>)[]) {
    const { routine_day_id, ...rest } = r
    out.days[routine_day_id] = { ...EMPTY_DAY_LOG, ...rest, checkin_note: rest.checkin_note ?? '', missed_reason: rest.missed_reason ?? '' }
  }
  return out
}

export const TrainingExtrasContext = createContext<TrainingExtras | null>(null)

export function useExerciseFeedback(exerciseId: string): ExerciseFeedback | null {
  return useContext(TrainingExtrasContext)?.exercises[exerciseId] ?? null
}

export function useDayLog(dayId: string): DayLog | null {
  return useContext(TrainingExtrasContext)?.days[dayId] ?? null
}

export interface UrgentMessage {
  id: string
  /**
   * 'urgent' = consulta urgente; 'pain' = dolor no habitual marcado en el chequeo diario;
   * 'last_week' / 'week_done' / 'routine_done' = avisos del alumno sobre su rutina.
   */
  kind: 'urgent' | 'pain' | RoutineNoticeKind
  routine_id: string | null
  student_id: string
  student_name: string
  student_phone: string | null
  message: string
  created_at: string
}

/** Consultas urgentes sin ver. Sin la migración devuelve vacío. */
export async function fetchUnreadUrgentMessages(ownerId: string): Promise<UrgentMessage[]> {
  const { data, error } = await supabase
    .from('student_urgent_messages')
    .select('*, student:students(full_name, phone)')
    .eq('owner_id', ownerId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error || !data) return []
  type S = { full_name?: string | null; phone?: string | null }
  type Row = { id: string; student_id: string; message: string; created_at: string; kind?: string | null; routine_id?: string | null; student: S | S[] | null }
  return (data as unknown as Row[]).map((r) => {
    const s = Array.isArray(r.student) ? r.student[0] : r.student
    return {
      id: r.id,
      kind: (['pain', 'last_week', 'week_done', 'routine_done'] as const).find((k) => k === r.kind) ?? 'urgent',
      routine_id: r.routine_id ?? null,
      student_id: r.student_id,
      message: r.message,
      created_at: r.created_at,
      student_name: s?.full_name ?? 'Alumno',
      student_phone: s?.phone ?? null,
    }
  })
}

export async function markUrgentMessageRead(id: string): Promise<void> {
  const { error } = await supabase.from('student_urgent_messages').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

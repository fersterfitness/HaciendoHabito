import { supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import { formatSeriesPlanLine, parseExerciseMeta } from '@/lib/routine/exerciseMeta'

/** Ejercicio tal como lo devuelve `get_shared_routine` (sin notas privadas del entrenador). */
export interface SharedRoutineExercise {
  id: string
  name: string | null
  sets: number | null
  reps_min: number | null
  reps_max: number | null
  reps_scheme: string | null
  weight_kg: number | null
  rir: number | null
  rpe: number | null
  rest_seconds: number | null
  tempo: string | null
  percent_rm: number | null
  technical_notes: string | null
  is_superset: boolean | null
  superset_group: number | null
  video_url: string | null
  image_url: string | null
  /** Lo que anotó el alumno, por serie (20261111150000_routine_exercise_logs.sql). */
  logs?: SharedSetLog[]
}

export interface SharedSetLog {
  set: number
  weight_kg: number | null
  reps: number | null
  completed?: boolean
}

export function isSetComplete(log: { completed?: boolean; weight_kg: number | null; reps?: number | null } | undefined): boolean {
  return !!log && (log.completed ?? (log.weight_kg != null || log.reps != null))
}

/** Explicit completion is independent of optional weight and reps. */
export async function saveSharedSet(
  token: string,
  exerciseId: string,
  setNumber: number,
  weightKg: number | null,
  completed: boolean,
  reps: number | null = null,
): Promise<void> {
  const args = { p_token: token, p_exercise_id: exerciseId, p_set_number: setNumber, p_weight_kg: weightKg, p_completed: completed }
  let { data, error } = await supabasePublic.rpc('save_shared_exercise_set', { ...args, p_reps: reps })
  // Sin la migración de repeticiones (20261111180000) se guarda igual, mientras no se hayan anotado reps.
  if (error?.code === 'PGRST202' && reps == null) ({ data, error } = await supabasePublic.rpc('save_shared_exercise_set', args))
  if (error?.code === 'PGRST202' && reps != null) throw new Error('Falta activar las repeticiones en la base de datos. Avisale a tu entrenador.')
  // Existing weight entry remains usable while the completion migration is being applied.
  if (error?.code === 'PGRST202' && completed && weightKg != null) {
    return logSharedSet(token, exerciseId, setNumber, weightKg)
  }
  if (error) throw new Error(/save_shared_exercise_set/.test(error.message)
    ? 'Falta activar el registro sin kilos en la base de datos. Avisale a tu entrenador.' : 'No se pudo guardar. Intentá de nuevo.')
  if (!(data as { ok?: boolean } | null)?.ok) throw new Error('No se pudo guardar. Intentá de nuevo.')
}

export interface SharedRoutineDay {
  id: string
  day_name: string
  muscle_focus: string | null
  warmup_notes: string | null
  exercises: SharedRoutineExercise[]
}

export interface SharedRoutineBlock {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  days: SharedRoutineDay[]
}

/** Lo que ve el alumno: su rutina vigente y el feedback de la semana. */
export interface SharedRoutine {
  student_first_name: string
  student_gender?: string | null
  professional_name: string | null
  professional_phone: string | null
  routine: {
    name: string
    objective: string | null
    start_date: string | null
    end_date: string | null
    updated_at: string | null
    blocks: SharedRoutineBlock[]
  } | null
  feedback: { public_token: string; email: string | null; gender?: string | null; period: string | null; done: boolean } | null
}

/**
 * Dominio público de la app para los links que se mandan al alumno. Con `VITE_SITE_URL` el link sale
 * siempre con el dominio real, aunque el entrenador esté usando la app desde otro lado (por ejemplo localhost).
 */
function publicOrigin(): string {
  const fromEnv = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim()
  return (fromEnv || window.location.origin).replace(/\/$/, '')
}

export function sharedRoutineUrl(token: string): string {
  return `${publicOrigin()}/rutina/${token}`
}

/** Formulario de feedback de la semana, con el correo del alumno ya cargado. */
export function sharedRoutineFeedbackUrl(fb: NonNullable<SharedRoutine['feedback']>): string {
  const base = `${publicOrigin()}/form/check-in/compartido/${fb.public_token}`
  return fb.email ? `${base}?email=${encodeURIComponent(fb.email)}` : base
}

/** El alumno abre el link sin sesión: va por el cliente anónimo. */
export async function fetchSharedRoutine(token: string): Promise<SharedRoutine | null> {
  const { data, error } = await supabasePublic.rpc('get_shared_routine', { p_token: token })
  if (error) throw new Error(error.message)
  return (data as SharedRoutine | null) ?? null
}

/** El alumno anota los kilos de una serie; `null` borra lo anotado. */
export async function logSharedSet(token: string, exerciseId: string, setNumber: number, weightKg: number | null): Promise<void> {
  const { data, error } = await supabasePublic.rpc('log_shared_exercise_set', {
    p_token: token,
    p_exercise_id: exerciseId,
    p_set_number: setNumber,
    p_weight_kg: weightKg,
  })
  if (error) throw new Error(/log_shared_exercise_set/.test(error.message) ? 'Falta correr la migración 20261111150000_routine_exercise_logs.sql' : error.message)
  const res = data as { ok?: boolean; error?: string } | null
  if (!res?.ok) throw new Error(res?.error ?? 'No se pudo guardar')
}

/** «62,5» o «62.5» → 62.5; vacío → null; texto que no es número → undefined. */
export function parseKg(raw: string): number | null | undefined {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) / 100 : undefined
}

/** Repeticiones: entero de 0 a 500. `null` si está vacío, `undefined` si no es válido. */
export function parseReps(raw: string): number | null | undefined {
  const t = raw.trim()
  if (!t) return null
  if (!/^\d{1,3}$/.test(t)) return undefined
  const n = Number(t)
  return n <= 500 ? n : undefined
}

export function formatKg(n: number | null | undefined): string {
  if (n == null) return ''
  return fmtNum(n)
}

export const ROUTINE_SHARE_CHANGED = 'hh:routine-share-changed'

/** Read only: opening a student card does not publish a new link. */
export async function findRoutineShareToken(ownerId: string, studentId: string): Promise<string | null> {
  const { data: found, error: readErr } = await supabase
    .from('routine_shares')
    .select('token')
    .eq('owner_id', ownerId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (readErr) throw new Error(missingTableHint(readErr.message))
  return (found?.token as string | undefined) ?? null
}

/** Token del link del alumno; lo crea la primera vez. */
export async function ensureRoutineShareToken(ownerId: string, studentId: string): Promise<string> {
  const found = await findRoutineShareToken(ownerId, studentId)
  if (found) return found
  const { data, error } = await supabase.from('routine_shares').insert({ owner_id: ownerId, student_id: studentId }).select('token').single()
  if (error) throw new Error(missingTableHint(error.message))
  window.dispatchEvent(new Event(ROUTINE_SHARE_CHANGED))
  return data.token as string
}

/** Link nuevo: el anterior deja de funcionar. */
export async function regenerateRoutineShareToken(ownerId: string, studentId: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, '')
  const { data, error } = await supabase
    .from('routine_shares')
    .upsert({ owner_id: ownerId, student_id: studentId, token, updated_at: new Date().toISOString() }, { onConflict: 'owner_id,student_id' })
    .select('token')
    .single()
  if (error) throw new Error(missingTableHint(error.message))
  window.dispatchEvent(new Event(ROUTINE_SHARE_CHANGED))
  return data.token as string
}

function missingTableHint(msg: string): string {
  return /routine_shares/.test(msg) && /exist|schema cache/i.test(msg)
    ? 'Falta correr en Supabase la migración 20261110130000_routine_shares.sql'
    : msg
}

export function sharedRoutineMessage(firstName: string, url: string): string {
  const hi = firstName.trim() ? `Hola ${firstName.trim()}!` : 'Hola!'
  return `${hi} Te paso tu rutina. La podés abrir desde el celu cuando quieras y siempre va a estar actualizada. Ahí mismo completás el feedback de la semana:\n\n${url}`
}

// ── Formato de cada ejercicio (lo que lee el alumno) ──

function fmtNum(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',')
}

/** «8–10», «8 / 6 / 5» o «12». */
export function repsText(ex: Pick<SharedRoutineExercise, 'reps_scheme' | 'reps_min' | 'reps_max'>): string {
  const scheme = ex.reps_scheme?.trim()
  if (scheme) return scheme
  if (ex.reps_min != null && ex.reps_max != null) return ex.reps_min === ex.reps_max ? String(ex.reps_min) : `${ex.reps_min}–${ex.reps_max}`
  if (ex.reps_min != null) return String(ex.reps_min)
  if (ex.reps_max != null) return String(ex.reps_max)
  return ''
}

/** Línea principal: «4 × 8–10», «3 series» o solo las reps. */
export function setsRepsText(ex: SharedRoutineExercise): string {
  const reps = repsText(ex)
  if (ex.sets != null && reps) return `${ex.sets} × ${reps}`
  if (ex.sets != null) return `${ex.sets} ${ex.sets === 1 ? 'serie' : 'series'}`
  return reps
}

/** «1:30» o «45 s». */
export function restText(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds <= 0) return null
  if (seconds < 60) return `${seconds} s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`
}

/** «8» → «RPE 8»; «RIR 2» o texto libre quedan como están. */
function effortLabel(raw: string | null | undefined): string | null {
  const t = raw?.trim().replace(/^@/, '') ?? ''
  if (!t) return null
  return /rir|rpe/i.test(t) || !/^\d/.test(t) ? t : `RPE ${t}`
}

/** Datos del ejercicio en pastillas (peso, esfuerzo, descanso, tempo) + plan por serie y notas. */
export function exerciseDetails(ex: SharedRoutineExercise): { chips: string[]; seriesPlan: string | null; notes: string } {
  const { userNotes, meta } = parseExerciseMeta(ex.technical_notes)
  const chips: string[] = []
  if (ex.weight_kg != null && ex.weight_kg > 0) chips.push(`${fmtNum(ex.weight_kg)} kg`)
  else if (ex.percent_rm != null && ex.percent_rm > 0) chips.push(`${fmtNum(ex.percent_rm)}% RM`)
  else if (meta.percent1rm?.trim()) chips.push(`${meta.percent1rm.trim().replace(/%$/, '')}% RM`)
  const effort = ex.rpe != null ? `RPE ${fmtNum(ex.rpe)}` : ex.rir != null ? `RIR ${fmtNum(ex.rir)}` : effortLabel(meta.rpeText)
  if (effort) chips.push(effort)
  const rest = restText(ex.rest_seconds) ?? (meta.restText?.trim() || null)
  if (rest) chips.push(`Descanso ${rest}`)
  if (ex.tempo?.trim()) chips.push(`Tempo ${ex.tempo.trim()}`)
  return { chips, seriesPlan: formatSeriesPlanLine(meta.seriesPlan), notes: userNotes.trim() }
}

/** Semana que corresponde a hoy: la que contiene la fecha; antes de empezar, la primera; después, la última. */
export function currentBlockIndex(blocks: Pick<SharedRoutineBlock, 'start_date' | 'end_date'>[], today: string): number {
  if (blocks.length === 0) return 0
  const inside = blocks.findIndex((b) => b.start_date && b.end_date && b.start_date <= today && today <= b.end_date)
  if (inside >= 0) return inside
  const started = blocks.map((b, i) => [b.start_date, i] as const).filter(([d]) => d && d <= today)
  return started.length ? started[started.length - 1]![1] : 0
}

/** Agrupa los ejercicios seguidos del mismo circuito (superserie). */
export function groupExercises(list: SharedRoutineExercise[]): { circuit: boolean; items: SharedRoutineExercise[] }[] {
  const out: { circuit: boolean; items: SharedRoutineExercise[]; key: number | null }[] = []
  for (const ex of list) {
    const key = ex.is_superset && ex.superset_group != null ? ex.superset_group : null
    const last = out[out.length - 1]
    if (key != null && last && last.key === key) last.items.push(ex)
    else out.push({ circuit: key != null, items: [ex], key })
  }
  return out.map(({ circuit, items }) => ({ circuit: circuit && items.length > 1, items }))
}

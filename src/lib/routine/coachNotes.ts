import { createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'
import { call, exerciseNoteKey } from '@/lib/routine/studentTrainingLog'

/**
 * Feedback nov19 (tanda 4): «Nota para el alumno» por ejercicio. La deja el entrenador al revisar lo anotado
 * y al alumno le aparece en ese ejercicio (en cualquier semana, por nombre) hasta que la oculta.
 * Requiere 20261125120000_notas_para_el_alumno.sql.
 */
export interface CoachNote {
  note: string
  updated_at: string
  /** Solo del lado del entrenador: cuándo la ocultó el alumno. */
  dismissed_at?: string | null
}

/** Clave del ejercicio: la misma que las notas propias del alumno. */
export const coachNoteKey = exerciseNoteKey

export const COACH_NOTE_MAX = 600

const missingTable = (msg: string | undefined) => /coach_exercise_notes/.test(msg ?? '') && /exist|schema cache/i.test(msg ?? '')

/** Notas que dejó el entrenador a un alumno. `null` sin la migración (no se ofrece escribirlas). */
export async function fetchCoachNotes(studentId: string): Promise<Record<string, CoachNote> | null> {
  const { data, error } = await supabase
    .from('coach_exercise_notes')
    .select('exercise_key, note, updated_at, dismissed_at')
    .eq('student_id', studentId)
  if (error) return null
  const out: Record<string, CoachNote> = {}
  for (const r of (data ?? []) as ({ exercise_key: string } & CoachNote)[])
    out[r.exercise_key] = { note: r.note, updated_at: r.updated_at, dismissed_at: r.dismissed_at }
  return out
}

/** Guarda (o borra, si llega vacía) la nota. Cambiar el texto la vuelve a mostrar aunque el alumno la haya ocultado. */
export async function saveCoachNote(ownerId: string, studentId: string, key: string, note: string): Promise<CoachNote | null> {
  const text = note.trim().slice(0, COACH_NOTE_MAX)
  if (!key) throw new Error('El ejercicio no tiene nombre')
  if (!text) {
    const { error } = await supabase.from('coach_exercise_notes').delete().eq('owner_id', ownerId).eq('student_id', studentId).eq('exercise_key', key)
    if (error) throw new Error(missingTable(error.message) ? 'Falta correr la migración 20261125120000_notas_para_el_alumno.sql' : error.message)
    return null
  }
  const { data, error } = await supabase
    .from('coach_exercise_notes')
    .upsert({ owner_id: ownerId, student_id: studentId, exercise_key: key, note: text }, { onConflict: 'owner_id,student_id,exercise_key' })
    .select('note, updated_at, dismissed_at')
    .single()
  if (error) throw new Error(missingTable(error.message) ? 'Falta correr la migración 20261125120000_notas_para_el_alumno.sql' : error.message)
  return data as CoachNote
}

/** El alumno la oculta desde el link. */
export async function dismissSharedCoachNote(token: string, key: string): Promise<void> {
  await call('dismiss_shared_coach_note', { p_token: token, p_exercise_key: key })
}

/** Dueño y alumno del link, para «Ver como profe» (solo lo encuentra el dueño con su sesión). */
export async function fetchShareOwner(token: string): Promise<{ owner_id: string; student_id: string } | null> {
  const { data } = await supabase.from('routine_shares').select('owner_id, student_id').eq('token', token).maybeSingle()
  return (data as { owner_id: string; student_id: string } | null) ?? null
}

/**
 * Feedback nov24 (tanda 2): varias notas, cada una de un ejercicio de una semana (el id de esa fila) o general
 * de un circuito (día + grupo). El alumno marca «Lo vi» en cada una. Requiere 20261127130000_notas_por_semana_y_circuito.sql.
 */
export interface CoachNoteItem {
  id: string
  exercise_id: string | null
  day_id: string | null
  circuit_group: number | null
  note: string
  created_at: string
  seen_at: string | null
}

export type CoachNoteTarget = { exerciseId: string } | { dayId: string; circuitGroup: number }

export const COACH_NOTE_ITEMS_MIGRATION = '20261127130000_notas_por_semana_y_circuito.sql'

const ITEM_COLS = 'id, exercise_id:routine_exercise_id, day_id, circuit_group, note, created_at, seen_at'

const itemsError = (msg: string | undefined) =>
  /coach_note_items/.test(msg ?? '') && /exist|schema cache/i.test(msg ?? '') ? `Falta correr la migración ${COACH_NOTE_ITEMS_MIGRATION}` : (msg ?? 'Error')

/** Las notas de un objetivo, en orden de carga. */
export function noteItemsFor(items: CoachNoteItem[] | null | undefined, target: CoachNoteTarget): CoachNoteItem[] {
  if (!items) return []
  return 'exerciseId' in target
    ? items.filter((n) => n.exercise_id === target.exerciseId)
    : items.filter((n) => n.day_id === target.dayId && n.circuit_group === target.circuitGroup)
}

/** `null` sin la migración. */
export async function fetchCoachNoteItems(studentId: string): Promise<CoachNoteItem[] | null> {
  const { data, error } = await supabase.from('coach_note_items').select(ITEM_COLS).eq('student_id', studentId).order('created_at')
  if (error) return null
  return (data ?? []) as unknown as CoachNoteItem[]
}

export async function addCoachNoteItem(ownerId: string, studentId: string, target: CoachNoteTarget, note: string): Promise<CoachNoteItem> {
  const text = note.trim().slice(0, COACH_NOTE_MAX)
  if (!text) throw new Error('La nota está vacía')
  const where = 'exerciseId' in target
    ? { routine_exercise_id: target.exerciseId }
    : { day_id: target.dayId, circuit_group: target.circuitGroup }
  const { data, error } = await supabase
    .from('coach_note_items')
    .insert({ owner_id: ownerId, student_id: studentId, note: text, ...where })
    .select(ITEM_COLS)
    .single()
  if (error) throw new Error(itemsError(error.message))
  return data as unknown as CoachNoteItem
}

/** Cambiar el texto la vuelve a dejar «sin ver». */
export async function updateCoachNoteItem(id: string, note: string): Promise<CoachNoteItem> {
  const text = note.trim().slice(0, COACH_NOTE_MAX)
  if (!text) throw new Error('La nota está vacía')
  const { data, error } = await supabase.from('coach_note_items').update({ note: text }).eq('id', id).select(ITEM_COLS).single()
  if (error) throw new Error(itemsError(error.message))
  return data as unknown as CoachNoteItem
}

export async function deleteCoachNoteItem(id: string): Promise<void> {
  const { error } = await supabase.from('coach_note_items').delete().eq('id', id)
  if (error) throw new Error(itemsError(error.message))
}

/** El alumno marca (o desmarca) «Lo vi» desde el link. */
export async function markSharedCoachNoteSeen(token: string, id: string, seen: boolean): Promise<void> {
  await call('mark_shared_coach_note_seen', { p_token: token, p_note_id: id, p_seen: seen })
}

/** Para el detalle de la rutina del entrenador. */
export interface CoachNotesState {
  ownerId: string
  studentId: string
  notes: Record<string, CoachNote>
  onSaved: (key: string, note: CoachNote | null) => void
  /** `null` sin la migración de nov24: se sigue usando la nota única por nombre. */
  items: CoachNoteItem[] | null
  onItemSaved: (item: CoachNoteItem) => void
  onItemDeleted: (id: string) => void
}

export const CoachNotesContext = createContext<CoachNotesState | null>(null)

export function useCoachNotes(): CoachNotesState | null {
  return useContext(CoachNotesContext)
}

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

/** Para el detalle de la rutina del entrenador. */
export interface CoachNotesState {
  ownerId: string
  studentId: string
  notes: Record<string, CoachNote>
  onSaved: (key: string, note: CoachNote | null) => void
}

export const CoachNotesContext = createContext<CoachNotesState | null>(null)

export function useCoachNotes(): CoachNotesState | null {
  return useContext(CoachNotesContext)
}

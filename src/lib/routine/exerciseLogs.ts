import { createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'

/** Una serie anotada por el alumno desde el link de la rutina. */
export interface ExerciseSetLog {
  set_number: number
  weight_kg: number | null
  reps: number | null
  completed?: boolean
  updated_at: string
}

/** Lo anotado por el alumno, por id de ejercicio de la rutina. */
export type ExerciseLogsByExercise = Map<string, ExerciseSetLog[]>

/**
 * Kilos que anotó el alumno en la rutina. Si la tabla todavía no existe (falta la migración
 * 20261111150000_routine_exercise_logs.sql) devuelve vacío: la rutina se ve igual que antes.
 */
export async function fetchRoutineExerciseLogs(routineId: string): Promise<ExerciseLogsByExercise> {
  const { data, error } = await supabase
    .from('routine_exercise_logs')
    .select('*')
    .eq('routine_id', routineId)
    .order('set_number')
  const out: ExerciseLogsByExercise = new Map()
  if (error || !data) return out
  for (const row of data as (ExerciseSetLog & { routine_exercise_id: string })[]) {
    const list = out.get(row.routine_exercise_id) ?? []
    list.push({ set_number: row.set_number, weight_kg: row.weight_kg, reps: row.reps, completed: row.completed, updated_at: row.updated_at })
    out.set(row.routine_exercise_id, list)
  }
  return out
}

export const ExerciseLogsContext = createContext<ExerciseLogsByExercise | null>(null)

export function useExerciseLogs(exerciseId: string): ExerciseSetLog[] {
  return useContext(ExerciseLogsContext)?.get(exerciseId) ?? []
}

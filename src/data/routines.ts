/** Rutinas: claves de caché y lectura del listado. */

import { supabase } from '@/lib/supabase'
import { queryClient } from '@/data/queryClient'
import type { Routine } from '@/types/database'

export const routineKeys = {
  all: ['routines'] as const,
  list: (userId: string | undefined, studentId?: string) =>
    ['routines', 'list', userId ?? 'anon', studentId ?? 'all'] as const,
}

/** Rutinas del entrenador (con datos básicos del alumno). Sin `studentId`, todas las asignadas. */
export async function fetchRoutineList(ownerId: string, studentId?: string): Promise<Routine[]> {
  const build = (includeFormerStudents: boolean) => {
    let query = supabase
      .from('routines')
      .select('*, student:students(full_name, level, status, avatar_path)')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    if (studentId) return query.eq('student_id', studentId)
    // Rutinas de alumnos eliminados siguen en el listado; las preestablecidas no.
    query = includeFormerStudents
      ? query.or('student_id.not.is.null,former_student_id.not.is.null')
      : query.not('student_id', 'is', null)
    return query
  }

  let { data, error } = await build(true)
  // Sin la migración 20261012120000 la columna former_student_id no existe.
  if (error?.code === '42703') ({ data, error } = await build(false))
  if (error) throw new Error(error.message)
  return (data as unknown as Routine[]) ?? []
}

export function invalidateRoutines(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: routineKeys.all })
}

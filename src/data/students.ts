/** Alumnos: claves de caché, lectura y escritura (única puerta de la UI a la tabla `students`). */

import { supabase } from '@/lib/supabase'
import { deleteOwnedStudent, fetchAccessibleStudents, updateAccessibleStudent } from '@/lib/students/studentAccess'
import { queryClient } from '@/data/queryClient'
import type { Student } from '@/types/database'

export const studentKeys = {
  all: ['students'] as const,
  list: (userId: string | undefined) => ['students', 'list', userId ?? 'anon'] as const,
}

/** Columnas con valor por defecto en la base: opcionales al crear un alumno. */
type StudentDefaultedColumns = 'selected_web_plan_slug' | 'intake_psychologist' | 'trainer_tags' | 'monthly_fee_amount' | 'target_weight_kg'
export type NewStudentPayload = Omit<Student, 'id' | 'owner_id' | 'created_at' | 'updated_at' | StudentDefaultedColumns> &
  Partial<Pick<Student, StudentDefaultedColumns>>

/** Alumnos que el profesional puede ver (propios y compartidos). */
export async function fetchStudentList(): Promise<Student[]> {
  const { data, error } = await fetchAccessibleStudents()
  if (error) throw new Error(error)
  return data
}

export async function insertStudent(ownerId: string, payload: NewStudentPayload): Promise<Student> {
  const { data, error } = await supabase
    .from('students')
    .insert({ ...payload, owner_id: ownerId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Student
}

export async function patchStudent(id: string, payload: Partial<Student>): Promise<Student> {
  const { data, error } = await updateAccessibleStudent(id, payload).select().single()
  if (error) throw new Error(error.message)
  return data as Student
}

export async function removeStudent(id: string, ownerId: string): Promise<void> {
  const { error } = await deleteOwnedStudent(id, ownerId)
  if (error) throw new Error(error.message)
}

/** Marca las listas de alumnos para recargar (después de crear, editar o borrar). */
export function invalidateStudents(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: studentKeys.all })
}

import { supabase } from '@/lib/supabase'
import type { Student, StudentStatus } from '@/types/database'

/**
 * Alumnos/pacientes visibles para el usuario actual (dueño directo o plan Full en student_owners).
 * Preferimos RPC: funciona aunque falte alguna política RLS de lectura compartida.
 */
export async function fetchAccessibleStudents(): Promise<{ data: Student[]; error: string | null }> {
  const { data, error } = await supabase.rpc('list_my_students')
  if (!error) {
    return { data: (data ?? []) as Student[], error: null }
  }

  if (import.meta.env.DEV) {
    console.warn('[studentAccess] list_my_students RPC:', error.message)
  }

  // Fallback: RLS (students_owner_read + students_shared_select + students_full_plan_nutritionist_select)
  const { data: fallback, error: fallbackError } = await accessibleStudentsSelect('*').order('full_name', {
    ascending: true,
  })
  if (fallbackError) return { data: [], error: fallbackError.message }
  return { data: (fallback ?? []) as Student[], error: null }
}

function isAccessibleStudentRow(row: Student | null | undefined): row is Student {
  return Boolean(row?.id)
}

export async function fetchAccessibleStudentById(
  id: string,
): Promise<{ data: Student | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_my_student', { p_student_id: id })
  const row = (Array.isArray(data) ? data[0] : data) as Student | null | undefined
  if (!error && isAccessibleStudentRow(row)) {
    return { data: row, error: null }
  }

  if (import.meta.env.DEV && error) {
    console.warn('[studentAccess] get_my_student RPC:', error.message)
  }

  // Misma visibilidad que el listado (evita fila “fantasma” con id null del RPC).
  const listed = await fetchAccessibleStudents()
  if (!listed.error) {
    const fromList = listed.data.find((s) => s.id === id)
    if (fromList) return { data: fromList, error: null }
  }

  const { data: fallback, error: fallbackError } = await accessibleStudentById(id)
  if (fallbackError) return { data: null, error: fallbackError.message }
  if (isAccessibleStudentRow(fallback as Student | null)) {
    return { data: fallback as Student, error: null }
  }
  return { data: null, error: listed.error ?? error?.message ?? null }
}

export function filterAccessibleStudents(
  students: Student[],
  opts?: { search?: string; status?: StudentStatus },
): Student[] {
  let rows = students
  if (opts?.status) rows = rows.filter((s) => s.status === opts.status)
  const q = opts?.search?.trim().toLowerCase()
  if (q) rows = rows.filter((s) => s.full_name.toLowerCase().includes(q))
  return rows
}

/** Consulta directa (RLS). Usar `fetchAccessibleStudents` en listados. */
export function accessibleStudentsSelect(
  columns = '*',
  options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean },
) {
  return supabase.from('students').select(columns, options)
}

export function accessibleStudentById(id: string, columns = '*') {
  return supabase.from('students').select(columns).eq('id', id).maybeSingle()
}

export function updateAccessibleStudent(id: string, payload: Partial<Student>) {
  return supabase.from('students').update(payload).eq('id', id)
}

/** Solo el dueño primario (`owner_id`) puede eliminar el registro. */
export function deleteOwnedStudent(id: string, ownerId: string) {
  return supabase.from('students').delete().eq('id', id).eq('owner_id', ownerId)
}

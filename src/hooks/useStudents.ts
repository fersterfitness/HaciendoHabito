import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Student } from '@/types/database'
import toast from 'react-hot-toast'
import {
  deleteOwnedStudent,
  fetchAccessibleStudents,
  filterAccessibleStudents,
  updateAccessibleStudent,
} from '@/lib/students/studentAccess'

/** Columnas con valor por defecto en la base: opcionales al crear un alumno. */
type StudentDefaultedColumns = 'selected_web_plan_slug' | 'intake_psychologist' | 'trainer_tags' | 'monthly_fee_amount' | 'target_weight_kg'
export type NewStudentPayload = Omit<Student, 'id' | 'owner_id' | 'created_at' | 'updated_at' | StudentDefaultedColumns> &
  Partial<Pick<Student, StudentDefaultedColumns>>

export function useStudents() {
  const { user } = useAuthStore()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStudents = useCallback(
    async (search?: string) => {
      if (!user) return
      setLoading(true)
      setError(null)

      const { data, error } = await fetchAccessibleStudents()
      if (error) { setError(error) }
      else { setStudents(filterAccessibleStudents(data, { search })) }
      setLoading(false)
    },
    [user]
  )

  const createStudent = useCallback(
    async (payload: NewStudentPayload) => {
      if (!user) return null
      const { data, error } = await supabase
        .from('students')
        .insert({ ...payload, owner_id: user.id })
        .select()
        .single()
      if (error) { toast.error(error.message); return null }
      toast.success('Alumno creado')
      return data
    },
    [user]
  )

  const updateStudent = useCallback(
    async (id: string, payload: Partial<Student>) => {
      if (!user) return null
      const { data, error } = await updateAccessibleStudent(id, payload).select().single()
      if (error) { toast.error(error.message); return null }
      toast.success('Alumno actualizado')
      return data
    },
    [user]
  )

  const deleteStudent = useCallback(async (id: string) => {
    if (!user) return false
    const { error } = await deleteOwnedStudent(id, user.id)
    if (error) { toast.error(error.message); return false }
    toast.success('Alumno eliminado')
    return true
  }, [user])

  return { students, loading, error, fetchStudents, createStudent, updateStudent, deleteStudent }
}

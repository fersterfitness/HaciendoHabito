import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Student } from '@/types/database'
import toast from 'react-hot-toast'

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

      let query = supabase
        .from('students')
        .select('*')
        .eq('owner_id', user.id)
        .order('full_name', { ascending: true })

      if (search) {
        query = query.ilike('full_name', `%${search}%`)
      }

      const { data, error } = await query
      if (error) { setError(error.message) }
      else { setStudents(data ?? []) }
      setLoading(false)
    },
    [user]
  )

  const createStudent = useCallback(
    async (payload: Omit<Student, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => {
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
      const { data, error } = await supabase
        .from('students')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) { toast.error(error.message); return null }
      toast.success('Alumno actualizado')
      return data
    },
    []
  )

  const deleteStudent = useCallback(async (id: string) => {
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Alumno eliminado')
    return true
  }, [])

  return { students, loading, error, fetchStudents, createStudent, updateStudent, deleteStudent }
}

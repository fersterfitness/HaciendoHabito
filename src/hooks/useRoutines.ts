import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Routine } from '@/types/database'
import toast from 'react-hot-toast'
import { addDays, format } from 'date-fns'

export function useRoutines() {
  const { user } = useAuthStore()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRoutines = useCallback(
    async (studentId?: string) => {
      if (!user) return
      setLoading(true)
      let query = supabase
        .from('routines')
        .select('*, student:students(full_name, level, status)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (studentId) query = query.eq('student_id', studentId)

      const { data, error } = await query
      if (error) toast.error(error.message)
      else setRoutines((data as unknown as Routine[]) ?? [])
      setLoading(false)
    },
    [user]
  )

  const createRoutine = useCallback(
    async (payload: {
      student_id: string
      student_plan_id?: string
      name: string
      objective: string
      level: string
      start_date: string
      duration_days: number
      price?: number
      notes?: string
    }) => {
      if (!user) return null
      const end_date = format(
        addDays(new Date(payload.start_date), payload.duration_days - 1),
        'yyyy-MM-dd'
      )
      const { data, error } = await supabase
        .from('routines')
        .insert({
          ...payload,
          owner_id: user.id,
          end_date,
          status: 'activa',
          price: payload.price ?? 0,
          notes: payload.notes ?? null,
          student_plan_id: payload.student_plan_id ?? null,
        })
        .select()
        .single()
      if (error) { toast.error(error.message); return null }
      toast.success('Rutina creada')
      return data
    },
    [user]
  )

  const updateRoutine = useCallback(async (id: string, payload: Partial<Routine>) => {
    if (!user) return null
    const { data, error } = await supabase
      .from('routines')
      .update(payload)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single()
    if (error) { toast.error(error.message); return null }
    toast.success('Rutina actualizada')
    return data
  }, [user])

  const deleteRoutine = useCallback(async (id: string) => {
    if (!user) return false
    const { error } = await supabase
      .from('routines')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id)
    if (error) { toast.error(error.message); return false }
    toast.success('Rutina eliminada')
    return true
  }, [user])

  return { routines, loading, fetchRoutines, createRoutine, updateRoutine, deleteRoutine }
}

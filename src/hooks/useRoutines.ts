import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Routine } from '@/types/database'
import toast from 'react-hot-toast'
import { addDays, format } from 'date-fns'
import { fetchRoutineList, invalidateRoutines, routineKeys } from '@/data/routines'

/** Vacío estable: un `[]` nuevo por render dispara en bucle los efectos que dependen de `routines`. */
const NO_ROUTINES: NonNullable<Awaited<ReturnType<typeof fetchRoutineList>>> = []

/**
 * Rutinas del entrenador. El listado vive en la caché (se ve al instante al volver y se
 * revalida); solo se pide cuando alguien llama a `fetchRoutines`.
 */
export function useRoutines() {
  const { user } = useAuthStore()
  const [filter, setFilter] = useState<{ active: boolean; studentId?: string }>({ active: false })
  const activeRef = useRef(false)

  const query = useQuery({
    queryKey: routineKeys.list(user?.id, filter.studentId),
    queryFn: () => fetchRoutineList(user!.id, filter.studentId),
    enabled: Boolean(user) && filter.active,
  })
  const routines = query.data ?? NO_ROUTINES
  const loading = filter.active && query.isPending

  useEffect(() => {
    if (query.error) toast.error(query.error.message)
  }, [query.error])

  // Identidad estable: las pantallas lo usan en efectos.
  const fetchRoutines = useCallback(async (studentId?: string) => {
    if (!activeRef.current) {
      activeRef.current = true
      setFilter({ active: true, studentId })
      return
    }
    setFilter((prev) => (prev.studentId === studentId ? prev : { active: true, studentId }))
    await invalidateRoutines()
  }, [])

  const createRoutine = useCallback(
    async (payload: {
      student_id?: string | null
      student_plan_id?: string
      name: string
      objective: string
      level: string
      start_date: string
      duration_days: number
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
          price: 0,
          notes: payload.notes ?? null,
          student_plan_id: payload.student_plan_id ?? null,
        })
        .select()
        .single()
      if (error) { toast.error(error.message); return null }
      toast.success('Rutina creada')
      void invalidateRoutines()
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
    void invalidateRoutines()
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
    void invalidateRoutines()
    return true
  }, [user])

  return { routines, loading, fetchRoutines, createRoutine, updateRoutine, deleteRoutine }
}

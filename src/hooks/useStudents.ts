import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { filterAccessibleStudents } from '@/lib/students/studentAccess'
import {
  fetchStudentList,
  insertStudent,
  invalidateStudents,
  patchStudent,
  removeStudent,
  studentKeys,
  type NewStudentPayload,
} from '@/data/students'
import type { Student } from '@/types/database'

export type { NewStudentPayload } from '@/data/students'

/**
 * Alumnos del profesional. La lista vive en la caché de TanStack Query: al volver a la
 * pantalla se ve al instante y se revalida en segundo plano. Solo se pide cuando alguien
 * llama a `fetchStudents` (las pantallas que solo editan no la descargan).
 */
export function useStudents() {
  const { user } = useAuthStore()
  const [active, setActive] = useState(false)
  const activeRef = useRef(false)
  const [search, setSearch] = useState<string | undefined>()

  const query = useQuery({
    queryKey: studentKeys.list(user?.id),
    queryFn: fetchStudentList,
    enabled: Boolean(user) && active,
  })

  const students = useMemo(
    () => filterAccessibleStudents(query.data ?? [], { search }),
    [query.data, search],
  )

  // Identidad estable: las pantallas lo usan en efectos.
  const fetchStudents = useCallback(async (nextSearch?: string) => {
    setSearch(nextSearch)
    if (!activeRef.current) {
      activeRef.current = true
      setActive(true)
      return
    }
    await invalidateStudents()
  }, [])

  /** Búsqueda: filtra la lista en memoria, sin volver a pedirla. */
  const filterStudents = useCallback((nextSearch: string) => setSearch(nextSearch), [])

  const createStudent = useCallback(
    async (payload: NewStudentPayload): Promise<Student | null> => {
      if (!user) return null
      try {
        const created = await insertStudent(user.id, payload)
        toast.success('Alumno creado')
        void invalidateStudents()
        return created
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear el alumno')
        return null
      }
    },
    [user],
  )

  const updateStudent = useCallback(
    async (id: string, payload: Partial<Student>): Promise<Student | null> => {
      if (!user) return null
      try {
        const updated = await patchStudent(id, payload)
        toast.success('Alumno actualizado')
        void invalidateStudents()
        return updated
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el alumno')
        return null
      }
    },
    [user],
  )

  const deleteStudent = useCallback(
    async (id: string) => {
      if (!user) return false
      try {
        await removeStudent(id, user.id)
        toast.success('Alumno eliminado')
        void invalidateStudents()
        return true
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el alumno')
        return false
      }
    },
    [user],
  )

  return {
    students,
    loading: active && query.isPending,
    error: query.error ? query.error.message : null,
    fetchStudents,
    filterStudents,
    createStudent,
    updateStudent,
    deleteStudent,
  }
}

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { StudentHabitsPanel } from '@/components/students/StudentHabitsPanel'
import type { Student } from '@/types/database'

/** Vista dedicada (barra lateral ya no enlaza acá): elegís alumno o venís con `?student=id` desde la ficha. */
export function HabitsPage() {
  const { user } = useAuthStore()
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (!user) return
    supabase
      .from('students')
      .select('id, full_name')
      .eq('owner_id', user.id)
      .eq('status', 'activo')
      .order('full_name')
      .then(({ data: s }) => setStudents(((s as Student[]) ?? []) as Student[]))
  }, [user])

  useEffect(() => {
    const sid = searchParams.get('student')
    if (sid) setSelectedStudent(sid)
  }, [searchParams])

  return (
    <div>
      <Header title="Hábitos" />

      <div className="mx-auto max-w-[min(1200px,calc(100%-2rem))] space-y-4 px-4 py-5 lg:px-6">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          El acceso principal está en la <strong className="text-ink-primary">ficha del alumno</strong>, solapa{' '}
          <strong className="text-ink-primary">Hábitos</strong> (<strong className="text-ink-primary">Vista amplia</strong> te
          trae a esta página). Desde acá podés cambiar de alumno cuando haga falta.
        </p>

        <div>
          <label htmlFor="habits-alumno" className="mb-1.5 block text-xs font-medium text-ink-secondary">
            Alumno
          </label>
          <select
            id="habits-alumno"
            className="w-full max-w-md rounded-md border border-zinc-200/80 bg-transparent px-3 py-2.5 text-sm text-ink-primary outline-none focus-visible:border-emerald-500/50 dark:border-zinc-700 dark:focus-visible:border-emerald-500/40"
            value={selectedStudent}
            onChange={(e) => {
              const v = e.target.value
              setSelectedStudent(v)
              if (v) setSearchParams({ student: v }, { replace: true })
              else setSearchParams({}, { replace: true })
            }}
          >
            <option value="">Seleccioná un alumno…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>

        {!selectedStudent ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Elegí un alumno"
            description="Seleccionando arriba se abre el mismo panel de hábitos que en la solapa del alumno."
          />
        ) : (
          <StudentHabitsPanel studentId={selectedStudent} key={selectedStudent} />
        )}
      </div>
    </div>
  )
}

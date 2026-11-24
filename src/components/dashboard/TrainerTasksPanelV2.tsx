import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { CardV2 } from '@/components/v2/ui'
import { controlSmClassName } from '@/lib/formControlClasses'
import { cn } from '@/lib/utils'
import {
  TRAINER_TASKS_MIGRATION,
  TRAINER_TASK_MAX,
  addTrainerTask,
  deleteTrainerTask,
  fetchTrainerTasks,
  setTrainerTaskDone,
  splitTrainerTasks,
  type TrainerTask,
} from '@/lib/dashboard/trainerTasks'

/**
 * Feedback nov24 (punto 5): «Mis tareas» del entrenador en el Inicio. Generales o de un alumno, con check;
 * aparte de los avisos y de «Para hoy». Las hechas quedan una semana para poder deshacerlas.
 */
export function TrainerTasksPanelV2({
  ownerId,
  students,
  onOpenStudent,
}: {
  ownerId: string
  students: { id: string; full_name: string }[]
  onOpenStudent: (id: string) => void
}) {
  const qc = useQueryClient()
  const key = ['v2', 'trainer-tasks', ownerId]
  const q = useQuery({ queryKey: key, queryFn: () => fetchTrainerTasks(ownerId), staleTime: 30_000 })
  const [text, setText] = useState('')
  const [studentId, setStudentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const tasks = q.data
  const nameById = new Map(students.map((s) => [s.id, s.full_name]))
  const setTasks = (fn: (prev: TrainerTask[]) => TrainerTask[]) => qc.setQueryData<TrainerTask[] | null>(key, (prev) => (prev ? fn(prev) : prev))

  async function add() {
    setBusy(true)
    try {
      const t = await addTrainerTask(ownerId, text, studentId || null)
      setTasks((prev) => [...prev, t])
      setText('')
      setStudentId('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la tarea')
    }
    setBusy(false)
  }

  async function toggle(t: TrainerTask, done: boolean) {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done_at: done ? new Date().toISOString() : null } : x)))
    try {
      await setTrainerTaskDone(t.id, done)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
      void qc.invalidateQueries({ queryKey: key })
    }
  }

  async function remove(t: TrainerTask) {
    setTasks((prev) => prev.filter((x) => x.id !== t.id))
    try {
      await deleteTrainerTask(t.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo borrar')
      void qc.invalidateQueries({ queryKey: key })
    }
  }

  if (q.isPending) return null
  if (tasks === null)
    return (
      <CardV2 title="Mis tareas">
        <p className="px-5 pb-4 text-2xs text-ink-muted">Falta correr el SQL {TRAINER_TASKS_MIGRATION} para poder anotar tareas.</p>
      </CardV2>
    )

  const { pending, done } = splitTrainerTasks(tasks ?? [])

  function row(t: TrainerTask) {
    const who = t.student_id ? nameById.get(t.student_id) : null
    return (
      <li key={t.id} className="flex items-start gap-2.5 py-2">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-primary"
          checked={!!t.done_at}
          onChange={(e) => void toggle(t, e.target.checked)}
          aria-label={t.done_at ? 'Volver a pendiente' : 'Marcar como hecha'}
        />
        <div className="min-w-0 flex-1">
          <p className={cn('whitespace-pre-line break-words text-sm text-ink-primary', t.done_at && 'text-ink-muted line-through')}>{t.text}</p>
          {who ? (
            <Button variant="ghost" size="sm" className="-ml-2 h-auto px-2 py-0.5 text-2xs text-ink-muted" onClick={() => onOpenStudent(t.student_id!)}>
              {who}
            </Button>
          ) : null}
        </div>
        <Button variant="ghost" size="iconSm" className="text-ink-muted hover:text-status-expired" onClick={() => void remove(t)} title="Borrar tarea" aria-label="Borrar tarea">
          <X className="h-3.5 w-3.5" />
        </Button>
      </li>
    )
  }

  return (
    <CardV2 title="Mis tareas" action={pending.length ? <span className="text-2xs text-ink-muted">{pending.length} pendiente{pending.length === 1 ? '' : 's'}</span> : null}>
      <form
        className="space-y-1.5 px-5 pt-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim() && !busy) void add()
        }}
      >
        <input
          className={cn(controlSmClassName, 'w-full px-2.5')}
          placeholder="Ej.: revisar calendario de Ailu"
          maxLength={TRAINER_TASK_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Nueva tarea"
        />
        <div className="flex gap-1.5">
          <select
            className={cn(controlSmClassName, 'min-w-0 flex-1 px-2')}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            aria-label="Alumno de la tarea"
          >
            <option value="">General</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" loading={busy} disabled={!text.trim()}>
            Agregar
          </Button>
        </div>
      </form>
      <ul className="divide-y divide-surface-border px-5 pb-2">
        {pending.length === 0 ? <li className="py-3 text-xs text-ink-muted">No tenés tareas pendientes.</li> : pending.map(row)}
      </ul>
      {done.length ? (
        <div className="px-5 pb-3">
          <Button variant="ghost" size="sm" className="-ml-2 text-2xs text-ink-muted" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Ocultar hechas' : `Hechas esta semana (${done.length})`}
          </Button>
          {showDone ? <ul className="divide-y divide-surface-border">{done.map(row)}</ul> : null}
        </div>
      ) : null}
    </CardV2>
  )
}

import { supabase } from '@/lib/supabase'

/**
 * Feedback nov24 (punto 5): tareas propias del entrenador en el Inicio, generales o de un alumno, con check.
 * Requiere 20261128120000_tareas_del_entrenador.sql.
 */
export const TRAINER_TASKS_MIGRATION = '20261128120000_tareas_del_entrenador.sql'
export const TRAINER_TASK_MAX = 300
/** Las hechas se siguen viendo (para deshacer) durante esta cantidad de días. */
export const DONE_VISIBLE_DAYS = 7

export interface TrainerTask {
  id: string
  student_id: string | null
  text: string
  done_at: string | null
  created_at: string
}

const COLS = 'id, student_id, text, done_at, created_at'

const friendly = (msg: string | undefined) =>
  /trainer_tasks/.test(msg ?? '') && /exist|schema cache/i.test(msg ?? '') ? `Falta correr la migración ${TRAINER_TASKS_MIGRATION}` : (msg ?? 'Error')

/** `null` sin la migración. */
export async function fetchTrainerTasks(ownerId: string): Promise<TrainerTask[] | null> {
  const { data, error } = await supabase.from('trainer_tasks').select(COLS).eq('owner_id', ownerId).order('created_at')
  if (error) return null
  return (data ?? []) as TrainerTask[]
}

export async function addTrainerTask(ownerId: string, text: string, studentId: string | null): Promise<TrainerTask> {
  const clean = text.trim().slice(0, TRAINER_TASK_MAX)
  if (!clean) throw new Error('Escribí la tarea')
  const { data, error } = await supabase.from('trainer_tasks').insert({ owner_id: ownerId, text: clean, student_id: studentId }).select(COLS).single()
  if (error) throw new Error(friendly(error.message))
  return data as TrainerTask
}

export async function setTrainerTaskDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('trainer_tasks').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id)
  if (error) throw new Error(friendly(error.message))
}

export async function deleteTrainerTask(id: string): Promise<void> {
  const { error } = await supabase.from('trainer_tasks').delete().eq('id', id)
  if (error) throw new Error(friendly(error.message))
}

/** Pendientes (las más viejas primero) y hechas de la última semana (las últimas primero). */
export function splitTrainerTasks(tasks: TrainerTask[], now = new Date()): { pending: TrainerTask[]; done: TrainerTask[] } {
  const since = now.getTime() - DONE_VISIBLE_DAYS * 86_400_000
  const pending = tasks.filter((t) => !t.done_at).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const done = tasks
    .filter((t) => t.done_at && new Date(t.done_at).getTime() >= since)
    .sort((a, b) => b.done_at!.localeCompare(a.done_at!))
  return { pending, done }
}

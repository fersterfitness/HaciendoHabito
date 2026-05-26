import { supabase } from '@/lib/supabase'
import type { RoutineDeletionLogEntry } from '@/types/database'

function rpcMissing(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('could not find the function') || m.includes('schema cache')
}

function tableMissing(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('routine_deletion_log') ||
    m.includes('does not exist') ||
    m.includes('schema cache')
  )
}

export async function fetchRoutineDeletionLog(opts: {
  userId: string
}): Promise<{ data: RoutineDeletionLogEntry[]; error: string | null }> {
  const { userId } = opts

  const { data, error } = await supabase.rpc('list_my_routine_deletions')

  if (!error) {
    return { data: (data ?? []) as RoutineDeletionLogEntry[], error: null }
  }

  if (rpcMissing(error.message)) {
    const tableRes = await supabase
      .from('routine_deletion_log')
      .select(
        'id, routine_id, routine_name, student_id, student_name, objective, level, status, start_date, end_date, deleted_at, deleted_by, restored_at',
      )
      .eq('owner_id', userId)
      .is('restored_at', null)
      .not('deleted_by', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(200)

    if (!tableRes.error && tableRes.data) {
      const profileIds = [
        ...new Set(tableRes.data.map((r) => r.deleted_by).filter(Boolean) as string[]),
      ]
      const namesById = new Map<string, string>()
      if (profileIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', profileIds)
        for (const p of profiles ?? []) namesById.set(p.id, p.full_name)
      }

      return {
        data: tableRes.data.map((row) => ({
          id: row.id,
          routine_id: row.routine_id,
          routine_name: row.routine_name,
          student_id: row.student_id,
          student_name: row.student_name,
          objective: row.objective,
          level: row.level,
          status: row.status,
          start_date: row.start_date,
          end_date: row.end_date,
          deleted_at: row.deleted_at,
          deleted_by: row.deleted_by,
          deleted_by_name: row.deleted_by ? namesById.get(row.deleted_by) ?? null : null,
          can_restore: true,
        })),
        error: null,
      }
    }

    if (tableMissing(tableRes.error?.message ?? '')) {
      return {
        data: [],
        error:
          'Falta aplicar las migraciones de rutinas eliminadas en Supabase (20260625130000 y 20260625131000).',
      }
    }

    return { data: [], error: tableRes.error?.message ?? error.message }
  }

  return { data: [], error: error.message }
}

export async function restoreDeletedRoutine(
  deletionLogId: string,
): Promise<{ routineId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('restore_deleted_routine', {
    p_deletion_log_id: deletionLogId,
  })

  if (!error) {
    return { routineId: (data as string) ?? null, error: null }
  }

  return { routineId: null, error: error.message }
}

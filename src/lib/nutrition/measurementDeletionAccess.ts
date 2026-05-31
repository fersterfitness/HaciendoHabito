import { supabase } from '@/lib/supabase'
import type { NutritionMeasurementDeletionLogEntry } from '@/types/database'

function rpcMissing(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('could not find the function') || m.includes('schema cache')
}

const MISSING_MIGRATION_MSG =
  'Falta aplicar la migración del historial de antropometrías eliminadas en Supabase (20260701120000).'

/** Elimina una antropometría. El trigger en DB guarda el snapshot en el historial. */
export async function deleteMeasurement(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('nutrition_measurements').delete().eq('id', id)
  return { error: error?.message ?? null }
}

/** Historial de antropometrías eliminadas (no restauradas) del nutricionista actual. */
export async function fetchMeasurementDeletionLog(
  studentId?: string,
): Promise<{ data: NutritionMeasurementDeletionLogEntry[]; error: string | null }> {
  const { data, error } = await supabase.rpc('list_my_nutrition_measurement_deletions', {
    p_student_id: studentId ?? null,
  })

  if (!error) {
    return { data: (data ?? []) as NutritionMeasurementDeletionLogEntry[], error: null }
  }

  if (rpcMissing(error.message)) {
    return { data: [], error: MISSING_MIGRATION_MSG }
  }

  return { data: [], error: error.message }
}

/** Restaura una antropometría eliminada desde el historial. */
export async function restoreDeletedMeasurement(
  deletionLogId: string,
): Promise<{ measurementId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('restore_deleted_nutrition_measurement', {
    p_deletion_log_id: deletionLogId,
  })

  if (!error) {
    return { measurementId: (data as string) ?? null, error: null }
  }

  if (rpcMissing(error.message)) {
    return { measurementId: null, error: MISSING_MIGRATION_MSG }
  }

  return { measurementId: null, error: error.message }
}

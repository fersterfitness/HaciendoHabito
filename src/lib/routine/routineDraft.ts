import { supabase } from '@/lib/supabase'

/**
 * Feedback nov24 (tanda 4, punto 11): rutina siguiente guardada sin activar (estado `borrador`). El alumno sigue
 * con la actual y no ve esta; al activarla arranca hoy y la actual pasa a terminada.
 * Requiere 20261128130000_rutinas_borrador_fechas_historial.sql.
 */
export const ROUTINE_DRAFT_MIGRATION = '20261128130000_rutinas_borrador_fechas_historial.sql'

const missing = (msg: string | undefined) => /borrador|activate_routine_draft|routine_status/.test(msg ?? '') && /exist|invalid input value|schema cache/i.test(msg ?? '')

/** Activa la rutina guardada. Devuelve cuántas rutinas activas del alumno quedaron terminadas. */
export async function activateRoutineDraft(routineId: string): Promise<number> {
  const { data, error } = await supabase.rpc('activate_routine_draft', { p_routine_id: routineId })
  if (error) throw new Error(missing(error.message) ? `Falta correr la migración ${ROUTINE_DRAFT_MIGRATION}` : error.message)
  return typeof data === 'number' ? data : 0
}

/** Mensaje para el error de guardar una rutina como borrador sin la migración. */
export function draftSaveError(msg: string | undefined): string | null {
  return missing(msg) ? `Para guardarla sin activar falta correr la migración ${ROUTINE_DRAFT_MIGRATION}` : null
}

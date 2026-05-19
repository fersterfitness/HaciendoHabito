import { supabase } from '@/lib/supabase'

/** Si pasó más de esto en `en_proceso`, asumimos que se cortó (pestaña cerrada, error, etc.). */
export const ROUTINE_PDF_STALE_MS = 10 * 60 * 1000

const STALE_MESSAGE =
  'La generación anterior se interrumpió. Tocá «Generar PDF» o «Reintentar» para continuar.'

export function isStaleRoutinePdfEnProceso(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return true
  return Date.now() - new Date(updatedAt).getTime() > ROUTINE_PDF_STALE_MS
}

/** Devuelve filas `en_proceso` abandonadas a `pendiente` para que no queden en «Generando…» para siempre. */
export async function recoverStaleRoutinePdfs(ownerId: string): Promise<number> {
  const staleBefore = new Date(Date.now() - ROUTINE_PDF_STALE_MS).toISOString()
  const { data, error } = await supabase
    .from('routine_pdfs')
    .update({ status: 'pendiente', error_message: STALE_MESSAGE })
    .eq('owner_id', ownerId)
    .eq('status', 'en_proceso')
    .lt('updated_at', staleBefore)
    .select('id')

  if (error) {
    console.warn('[routine_pdfs] recover stale', error.message)
    return 0
  }
  return data?.length ?? 0
}

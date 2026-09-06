import { addDays, format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { Json, RoutineBlueprint } from '@/types/database'
import {
  blueprintAudience,
  blueprintLibraryRoutineId,
  blueprintObjective,
  withBlueprintMeta,
} from '@/lib/routine/blueprintFolders'
import {
  applyBlueprintPayloadToRoutine,
  serializeBlocksToBlueprint,
  type RoutineBlueprintPayload,
} from '@/lib/routine/routineBlueprint'

export const LIBRARY_ROUTINE_SQL_HINT =
  'Falta un cambio en la base: student_id de rutinas tiene que poder ser nulo. Corré el SQL de rutinas de biblioteca (20260906193000).'

type BlockWithDays = Parameters<typeof serializeBlocksToBlueprint>[0][number]

function looksLikeNotNullStudent(message: string): boolean {
  return /null value.*student_id|student_id.*not-null|violates not-null constraint/i.test(message)
}

/** Crea o reabre la rutina de biblioteca ligada a una variante preestablecida. */
export async function ensureLibraryRoutineForBlueprint(
  ownerId: string,
  bp: RoutineBlueprint,
): Promise<{ routineId: string } | { error: string }> {
  const existingId = blueprintLibraryRoutineId(bp)
  if (existingId) {
    const { data } = await supabase.from('routines').select('id').eq('id', existingId).maybeSingle()
    if (data?.id) return { routineId: data.id }
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const duration = 28
  const audience = blueprintAudience(bp).toLowerCase()
  const level =
    audience === 'inicial' || audience === 'intermedio' || audience === 'avanzado'
      ? audience
      : 'inicial'

  const { data: created, error } = await supabase
    .from('routines')
    .insert({
      owner_id: ownerId,
      student_id: null,
      name: bp.name,
      objective: blueprintObjective(bp) || bp.name,
      level,
      start_date: today,
      duration_days: duration,
      end_date: format(addDays(new Date(), duration - 1), 'yyyy-MM-dd'),
      status: 'activa',
      price: 0,
      notes: 'Rutina preestablecida (sin alumno)',
    })
    .select('id')
    .single()

  if (error || !created) {
    const msg = error?.message ?? 'No se pudo crear la rutina de biblioteca'
    return { error: looksLikeNotNullStudent(msg) ? LIBRARY_ROUTINE_SQL_HINT : msg }
  }

  const payload = bp.payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const blocks = (payload as { blocks?: unknown }).blocks
    if (Array.isArray(blocks) && blocks.length > 0) {
      try {
        await applyBlueprintPayloadToRoutine(created.id, payload as RoutineBlueprintPayload)
      } catch {
        // El editor igual se abre; se puede armar de cero.
      }
    }
  }

  const nextPayload = withBlueprintMeta(bp.payload, { library_routine_id: created.id })
  const { error: linkError } = await supabase
    .from('routine_blueprints')
    .update({ payload: nextPayload })
    .eq('id', bp.id)
  if (linkError) {
    return { error: linkError.message }
  }

  return { routineId: created.id }
}

/** Copia semanas/días/ejercicios de la rutina de biblioteca al payload de la variante. */
export async function syncLibraryBlueprintPayload(
  blueprintId: string,
  blocks: BlockWithDays[],
  existingPayload: Json | null | undefined,
): Promise<Json> {
  const serialized = serializeBlocksToBlueprint(blocks)
  const meta =
    existingPayload && typeof existingPayload === 'object' && !Array.isArray(existingPayload)
      ? (existingPayload as Record<string, unknown>)
      : {}
  const next = {
    ...meta,
    v: serialized.v,
    blocks: serialized.blocks,
  } as Json
  const { error } = await supabase
    .from('routine_blueprints')
    .update({ payload: next })
    .eq('id', blueprintId)
  if (error) throw new Error(error.message)
  return next
}

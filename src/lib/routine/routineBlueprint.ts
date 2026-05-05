import { supabase } from '@/lib/supabase'
import type { RoutineBlock, RoutineDay, RoutineExercise } from '@/types/database'

export const ROUTINE_BLUEPRINT_VERSION = 1 as const

export type RoutineBlueprintExercise = Pick<
  RoutineExercise,
  | 'exercise_id'
  | 'sort_order'
  | 'sets'
  | 'reps_min'
  | 'reps_max'
  | 'reps_scheme'
  | 'weight_kg'
  | 'rir'
  | 'rpe'
  | 'rest_seconds'
  | 'tempo'
  | 'video_url'
  | 'technical_notes'
  | 'is_superset'
  | 'superset_group'
>

export type RoutineBlueprintDay = Pick<
  RoutineDay,
  'day_name' | 'day_of_week' | 'muscle_focus' | 'warmup_notes' | 'sort_order'
> & { exercises: RoutineBlueprintExercise[] }

export type RoutineBlueprintBlock = Pick<
  RoutineBlock,
  'name' | 'sort_order' | 'notes' | 'start_date' | 'end_date'
> & { days: RoutineBlueprintDay[] }

export type RoutineBlueprintPayload = {
  v: typeof ROUTINE_BLUEPRINT_VERSION
  blocks: RoutineBlueprintBlock[]
}

type BlockWithDays = RoutineBlock & {
  days: (RoutineDay & { exercises: (RoutineExercise & { exercise?: unknown })[] })[]
}

export function serializeBlocksToBlueprint(blocks: BlockWithDays[]): RoutineBlueprintPayload {
  return {
    v: ROUTINE_BLUEPRINT_VERSION,
    blocks: blocks.map((b) => ({
      name: b.name,
      sort_order: b.sort_order,
      notes: b.notes,
      start_date: b.start_date,
      end_date: b.end_date,
      days: [...b.days]
        .sort((a, c) => a.sort_order - c.sort_order)
        .map((d) => ({
          day_name: d.day_name,
          day_of_week: d.day_of_week,
          muscle_focus: d.muscle_focus,
          warmup_notes: d.warmup_notes,
          sort_order: d.sort_order,
          exercises: [...d.exercises]
            .sort((a, c) => a.sort_order - c.sort_order)
            .map((ex) => ({
              exercise_id: ex.exercise_id,
              sort_order: ex.sort_order,
              sets: ex.sets,
              reps_min: ex.reps_min,
              reps_max: ex.reps_max,
              reps_scheme: ex.reps_scheme,
              weight_kg: ex.weight_kg,
              rir: ex.rir,
              rpe: ex.rpe,
              rest_seconds: ex.rest_seconds,
              tempo: ex.tempo,
              video_url: ex.video_url,
              technical_notes: ex.technical_notes,
              is_superset: ex.is_superset,
              superset_group: ex.superset_group,
            })),
        })),
    })),
  }
}

/** Inserta bloques/días/ejercicios de una plantilla en una rutina (sin borrar lo existente). */
export async function applyBlueprintPayloadToRoutine(
  routineId: string,
  payload: RoutineBlueprintPayload,
): Promise<void> {
  if (payload.v !== ROUTINE_BLUEPRINT_VERSION) throw new Error('Versión de plantilla no soportada')

  for (const block of payload.blocks) {
    const { data: createdBlock, error: blockError } = await supabase
      .from('routine_blocks')
      .insert({
        routine_id: routineId,
        name: block.name,
        sort_order: block.sort_order,
        notes: block.notes,
        start_date: block.start_date,
        end_date: block.end_date,
      })
      .select('id')
      .single()
    if (blockError || !createdBlock) throw new Error(blockError?.message ?? 'No se pudo crear bloque desde plantilla')

    for (const day of block.days) {
      const { data: createdDay, error: dayError } = await supabase
        .from('routine_days')
        .insert({
          block_id: createdBlock.id,
          day_name: day.day_name,
          day_of_week: day.day_of_week,
          muscle_focus: day.muscle_focus,
          warmup_notes: day.warmup_notes,
          sort_order: day.sort_order,
        })
        .select('id')
        .single()
      if (dayError || !createdDay) throw new Error(dayError?.message ?? 'No se pudo crear día desde plantilla')

      for (const ex of day.exercises) {
        const { error: exerciseError } = await supabase.from('routine_exercises').insert({
          day_id: createdDay.id,
          exercise_id: ex.exercise_id,
          sort_order: ex.sort_order,
          sets: ex.sets,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          reps_scheme: ex.reps_scheme,
          weight_kg: ex.weight_kg,
          rir: ex.rir,
          rpe: ex.rpe,
          rest_seconds: ex.rest_seconds,
          tempo: ex.tempo,
          video_url: ex.video_url,
          technical_notes: ex.technical_notes,
          is_superset: ex.is_superset,
          superset_group: ex.superset_group,
        })
        if (exerciseError) throw new Error(exerciseError.message)
      }
    }
  }
}

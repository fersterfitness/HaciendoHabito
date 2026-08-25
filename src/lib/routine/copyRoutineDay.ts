import type { RoutineDay, RoutineExercise } from '@/types/database'

export type DayCopySource = RoutineDay & { exercises: RoutineExercise[] }

export function dayInsertPayload(source: DayCopySource, targetBlockId: string, sortOrder: number, nameSuffix = '') {
  return {
    block_id: targetBlockId,
    day_name: nameSuffix ? `${source.day_name}${nameSuffix}` : source.day_name,
    day_of_week: source.day_of_week,
    muscle_focus: source.muscle_focus,
    warmup_notes: source.warmup_notes,
    sort_order: sortOrder,
  }
}

export function exerciseInsertPayload(ex: RoutineExercise, dayId: string) {
  return {
    day_id: dayId,
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
    technical_notes: ex.technical_notes,
    is_superset: ex.is_superset,
    superset_group: ex.superset_group,
    video_url: ex.video_url,
    training_method_id: ex.training_method_id,
    percent_rm: ex.percent_rm,
    method_coach_notes: ex.method_coach_notes,
  }
}

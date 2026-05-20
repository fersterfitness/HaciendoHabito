import { buildExerciseTechnicalNotes, parseExerciseMeta } from '@/lib/routine/exerciseMeta'
import type { Exercise, RoutineExercise } from '@/types/database'

const MULTIARTICULAR_SLUG = 'multiarticulares'

export type ExercisePrescriptionPatch = Pick<
  RoutineExercise,
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

/** Ejercicios del grupo muscular «Multiarticulares» copian reps por serie al duplicar el día. */
export function isMultiarticularExercise(
  exercise?: Pick<Exercise, 'muscle_group'> | null,
): boolean {
  const slug = exercise?.muscle_group?.slug?.trim().toLowerCase()
  return slug === MULTIARTICULAR_SLUG
}

/**
 * Copia prescipción (series, cargas, descanso, META: circuito, %1RM, etc.) sin `exercise_id`.
 * Las NOTAS libres no se copian. Las reps por serie solo si `copyRepsScheme` (multiarticulares).
 */
export function prescriptionPatchFrom(
  src: RoutineExercise,
  target?: RoutineExercise,
  options?: { copyRepsScheme?: boolean },
): ExercisePrescriptionPatch {
  const { meta } = parseExerciseMeta(src.technical_notes)
  const keepUserNotes = target ? parseExerciseMeta(target.technical_notes).userNotes : ''
  const technical_notes = buildExerciseTechnicalNotes(keepUserNotes, meta) || null
  const copyReps = options?.copyRepsScheme !== false

  return {
    sets: src.sets,
    reps_min: src.reps_min,
    reps_max: src.reps_max,
    reps_scheme: copyReps ? src.reps_scheme : (target?.reps_scheme ?? null),
    weight_kg: src.weight_kg,
    rir: src.rir,
    rpe: src.rpe,
    rest_seconds: src.rest_seconds,
    tempo: src.tempo,
    video_url: src.video_url,
    technical_notes,
    is_superset: src.is_superset,
    superset_group: src.superset_group,
  }
}

/** Segmenta por orden: ejercicio suelto o circuito (mismo superset_group consecutivo). */
export function segmentSourceExercises(sorted: RoutineExercise[]): Array<{
  kind: 'single' | 'circuit'
  indices: number[]
}> {
  const segments: Array<{ kind: 'single' | 'circuit'; indices: number[] }> = []
  let i = 0
  while (i < sorted.length) {
    const ex = sorted[i]
    if (!ex.is_superset || ex.superset_group === null) {
      segments.push({ kind: 'single', indices: [i] })
      i += 1
    } else {
      const gid = ex.superset_group
      const start = i
      while (i < sorted.length && sorted[i].superset_group === gid) i++
      const indices: number[] = []
      for (let k = start; k < i; k++) indices.push(k)
      segments.push({ kind: 'circuit', indices })
    }
  }
  return segments
}

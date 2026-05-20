import { buildExerciseTechnicalNotes, parseExerciseMeta } from '@/lib/routine/exerciseMeta'
import type { RoutineExercise } from '@/types/database'

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

/**
 * Copia prescipción (series, reps, cargas, descanso, META: circuito, %1RM, etc.) sin `exercise_id`.
 * Las NOTAS libres del ejercicio no se copian: se conservan las del destino (`target`).
 */
export function prescriptionPatchFrom(
  src: RoutineExercise,
  target?: RoutineExercise,
): ExercisePrescriptionPatch {
  const { meta } = parseExerciseMeta(src.technical_notes)
  const keepUserNotes = target ? parseExerciseMeta(target.technical_notes).userNotes : ''
  const technical_notes = buildExerciseTechnicalNotes(keepUserNotes, meta) || null

  return {
    sets: src.sets,
    reps_min: src.reps_min,
    reps_max: src.reps_max,
    reps_scheme: src.reps_scheme,
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

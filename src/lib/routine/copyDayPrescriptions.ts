import { buildExerciseTechnicalNotes, parseExerciseMeta, type ExerciseMeta } from '@/lib/routine/exerciseMeta'
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
  options?: {
    copyRepsScheme?: boolean
    /**
     * 1RM del alumno para el ejercicio de DESTINO (`null` = no tiene). Si se pasa, los kilos que salen
     * de un porcentaje se recalculan con ese 1RM: cada ejercicio tiene el suyo, y copiar los kilos del
     * origen dejaba cargado el peso de otro ejercicio.
     */
    targetRmKg?: number | null
  },
): ExercisePrescriptionPatch {
  const parsed = parseExerciseMeta(src.technical_notes)
  const rebase = options?.targetRmKg !== undefined
  const rm = options?.targetRmKg ?? null
  const meta = rebase ? rebaseMetaLoads(parsed.meta, rm) : parsed.meta
  const keepUserNotes = target ? parseExerciseMeta(target.technical_notes).userNotes : ''
  const technical_notes = buildExerciseTechnicalNotes(keepUserNotes, meta) || null
  const copyReps = options?.copyRepsScheme !== false
  const pct = parsePct(parsed.meta.percent1rm)
  const weight_kg = rebase && pct != null ? kgFromPct(rm, pct) : src.weight_kg

  return {
    sets: src.sets,
    reps_min: src.reps_min,
    reps_max: src.reps_max,
    reps_scheme: copyReps ? src.reps_scheme : (target?.reps_scheme ?? null),
    weight_kg,
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

function parsePct(raw: string | undefined): number | null {
  const n = Number((raw ?? '').replace(',', '.'))
  return raw?.trim() && Number.isFinite(n) && n > 0 ? n : null
}

function kgFromPct(rmKg: number | null, pct: number): number | null {
  return rmKg != null && rmKg > 0 ? Math.round(rmKg * (pct / 100) * 10) / 10 : null
}

/** El plan serie por serie guarda los kilos ya calculados: se rehacen con el 1RM del destino. */
function rebaseMetaLoads(meta: ExerciseMeta, rmKg: number | null): ExerciseMeta {
  if (!meta.seriesPlan?.length) return meta
  return {
    ...meta,
    seriesPlan: meta.seriesPlan.map((s) => {
      const pct = parsePct(s.pct)
      if (pct == null) return s
      const kg = kgFromPct(rmKg, pct)
      return { ...s, kg: kg != null ? String(kg) : '' }
    }),
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

import { type ExerciseMeta, parseExerciseMeta, buildExerciseTechnicalNotes } from '@/lib/routine/exerciseMeta'
import type { CyclePhaseColor } from '@/lib/routine/menstrualCyclePlanning'
import type { Routine, RoutineBlock, RoutineDay, RoutineExercise, Exercise, Student } from '@/types/database'

/** Tipos, constantes y helpers compartidos por la pantalla de rutina y sus subcomponentes. */
// ─── Types ────────────────────────────────────────────────────────────────────

export type ExWithExercise  = RoutineExercise & { exercise?: Exercise }
export type DayWithEx       = RoutineDay      & { exercises: ExWithExercise[] }
export type BlockWithDays   = RoutineBlock    & { days: DayWithEx[] }
export type RoutineFull     = Routine         & { student?: Student }
export type ExerciseWithGroup = Exercise & { muscle_group?: { id: string; name: string; sort_order: number } }
export const WARMUP_PRESETS = [
  {
    label: 'Día de empuje',
    text: `2/3 vueltas
1) Movilidad torácica x10 por lado
2) Movilidad de hombros con palo x10
3) Manguito rotador con bandas x10 por lado
4) Plancha estática 30-40''`,
  },
  {
    label: 'Día de piernas',
    text: `1) Movilidad cadera 90/90 x10 por lado
2) Movilidad de tobillo x10 por lado
3) Movilidad de cadera parado x10 por lado
4) Activación zona media`,
  },
  {
    label: 'Día de tracción',
    text: `1) Movilidad dorso-lumbar en cuadrupedia x10 por lado
2) Retracciones escapulares x12
3) Movilidad torácica en plancha x10 por lado
4) Activación zona media`,
  },
]

export function parseRestToSeconds(value: string): number | null {
  const v = value.trim().toLowerCase()
  if (!v) return null
  if (/^\d+$/.test(v)) return Number(v)
  const minMatch = v.match(/^(\d+(?:[.,]\d+)?)\s*(m|min|')$/)
  if (minMatch) return Math.round(Number(minMatch[1].replace(',', '.')) * 60)
  const secMatch = v.match(/^(\d+(?:[.,]\d+)?)\s*(s|seg|sec|''|")$/)
  if (secMatch) return Math.round(Number(secMatch[1].replace(',', '.')))
  const mmssMatch = v.match(/^(\d{1,2}):(\d{1,2})$/)
  if (mmssMatch) return Number(mmssMatch[1]) * 60 + Number(mmssMatch[2])
  return null
}

export function parseRpeToNumber(value: string): number | null {
  const v = value.trim().replace(',', '.')
  if (!v) return null
  const match = v.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const n = Number(match[1])
  if (Number.isNaN(n) || n < 1 || n > 10) return null
  return n
}

/** Actualiza `circuitNote` en todos los miembros del circuito en un solo `setBlocks` (sin carreras). */
export function applyCircuitNoteToBlocks(
  prev: BlockWithDays[],
  dayId: string,
  groupId: number,
  value: string,
): BlockWithDays[] {
  const patchMap = new Map<string, string | null>()
  for (const block of prev) {
    const day = block.days.find((d) => d.id === dayId)
    if (!day) continue
    for (const e of day.exercises) {
      if (e.superset_group !== groupId) continue
      const { userNotes, meta } = parseExerciseMeta(e.technical_notes)
      const nextMeta: ExerciseMeta = { ...meta, circuitNote: value || undefined }
      patchMap.set(e.id, buildExerciseTechnicalNotes(userNotes, nextMeta) || null)
    }
  }
  if (patchMap.size === 0) return prev
  return prev.map((block) => ({
    ...block,
    days: block.days.map((d) =>
      d.id !== dayId
        ? d
        : {
            ...d,
            exercises: d.exercises.map((ex) => {
              const tn = patchMap.get(ex.id)
              return tn !== undefined ? { ...ex, technical_notes: tn } : ex
            }),
          },
    ),
  }))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── BlockCard ────────────────────────────────────────────────────────────────

/** Clases por fase del ciclo (chips de aviso al entrenador). */
export const CYCLE_PHASE_CLASSES: Record<CyclePhaseColor, { chip: string; panel: string }> = {
  red: {
    chip: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
    panel: 'hh-alert hh-alert-danger text-ink-primary',
  },
  amber: {
    chip: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    panel: 'hh-alert hh-alert-warning text-ink-primary',
  },
  violet: {
    chip: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    panel: 'hh-alert hh-alert-violet text-ink-primary',
  },
  sky: {
    chip: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    panel: 'hh-alert hh-alert-info text-ink-primary',
  },
}

export type RenderGroup =
  | { type: 'single'; exercise: ExWithExercise }
  | { type: 'superset'; groupId: number; exercises: ExWithExercise[] }

export function groupExercises(exercises: ExWithExercise[]): RenderGroup[] {
  const result: RenderGroup[] = []
  const seen = new Set<string>()
  for (const ex of exercises) {
    if (seen.has(ex.id)) continue
    if (ex.is_superset && ex.superset_group !== null) {
      const members = exercises.filter(e => e.superset_group === ex.superset_group)
      members.forEach(m => seen.add(m.id))
      result.push({ type: 'superset', groupId: ex.superset_group, exercises: members })
    } else {
      seen.add(ex.id)
      result.push({ type: 'single', exercise: ex })
    }
  }
  return result
}

export type MuscleGroupOption = { id: string; name: string }

import { parseExerciseMeta } from '@/lib/routine/exerciseMeta'
import type { Exercise, RoutineBlock, RoutineDay, RoutineExercise } from '@/types/database'

export type GuideExerciseRow = {
  key: string
  label: string
  /** Aclaración de bloque / circuito (solo lectura en guía). */
  clarifications: string | null
  /** series → texto reps por semana (índice = semana). */
  weeks: (string | null)[]
}

export type GuideDaySection = {
  dayKey: string
  dayTitle: string
  warmupByWeek: (string | null)[]
  blockNotesByWeek: (string | null)[]
  rows: GuideExerciseRow[]
}

type Ex = RoutineExercise & { exercise?: Exercise }
type Day = RoutineDay & { exercises: Ex[] }
type Block = RoutineBlock & { days: Day[] }

function formatSetsReps(ex: Ex): string | null {
  const sets = ex.sets
  const scheme = ex.reps_scheme?.trim()
  if (sets != null && scheme) return `${sets} × ${scheme}`
  if (sets != null) return `${sets} series`
  if (scheme) return scheme
  if (ex.reps_min != null && ex.reps_max != null) {
    return ex.reps_min === ex.reps_max ? `${ex.reps_min} reps` : `${ex.reps_min}–${ex.reps_max} reps`
  }
  return null
}

function exerciseLabel(ex: Ex): string {
  return ex.exercise?.name?.trim() || 'Ejercicio'
}

function rowKeyForExercise(ex: Ex, groupIndex: number): string {
  if (ex.is_superset && ex.superset_group != null) {
    return `ss-${ex.superset_group}-${groupIndex}`
  }
  return `ex-${ex.exercise_id}-${groupIndex}`
}

function buildRowLabel(group: Ex[], dayName: string): string {
  if (group.length === 1) return exerciseLabel(group[0]!)
  const names = group.map(exerciseLabel).join(' + ')
  return `${names} (circuito)`
}

function circuitClarification(group: Ex[]): string | null {
  for (const ex of group) {
    const { meta } = parseExerciseMeta(ex.technical_notes)
    const note = meta.circuitNote?.trim()
    if (note) return note
  }
  return null
}

function orderedGroups(day: Day): Ex[][] {
  const groups: Ex[][] = []
  const seenCircuit = new Set<number>()
  for (const ex of [...day.exercises].sort((a, b) => a.sort_order - b.sort_order)) {
    if (ex.is_superset && ex.superset_group != null) {
      if (seenCircuit.has(ex.superset_group)) continue
      seenCircuit.add(ex.superset_group)
      groups.push(
        day.exercises
          .filter((e) => e.superset_group === ex.superset_group)
          .sort((a, b) => a.sort_order - b.sort_order),
      )
    } else if (!ex.is_superset) {
      groups.push([ex])
    }
  }
  return groups
}

/**
 * Agrupa por nombre de día y alinea filas entre semanas (solo planificación: series/reps, aclaraciones).
 */
export function buildRoutineProgressionGuide(blocks: Block[]): GuideDaySection[] {
  const sortedBlocks = [...blocks].sort((a, b) => a.sort_order - b.sort_order)
  const weekCount = sortedBlocks.length

  const dayKeys = new Map<string, { title: string; order: number }>()
  for (const block of sortedBlocks) {
    for (const day of block.days) {
      const key = day.day_name.trim() || `dia-${day.sort_order}`
      if (!dayKeys.has(key)) {
        dayKeys.set(key, { title: day.day_name.trim() || key, order: day.sort_order })
      }
    }
  }

  const sections: GuideDaySection[] = []

  for (const [dayKey, meta] of [...dayKeys.entries()].sort((a, b) => a[1].order - b[1].order)) {
    const rowMap = new Map<string, GuideExerciseRow>()
    const warmupByWeek: (string | null)[] = Array(weekCount).fill(null)
    const blockNotesByWeek: (string | null)[] = Array(weekCount).fill(null)

    sortedBlocks.forEach((block, weekIdx) => {
      const day = block.days.find((d) => (d.day_name.trim() || `dia-${d.sort_order}`) === dayKey)
      blockNotesByWeek[weekIdx] = block.notes?.trim() || null
      if (!day) return
      warmupByWeek[weekIdx] = day.warmup_notes?.trim() || null

      const groups = orderedGroups(day)
      groups.forEach((group, groupIndex) => {
        const key = rowKeyForExercise(group[0]!, groupIndex)
        const label = buildRowLabel(group, day.day_name)
        const clarifications = circuitClarification(group)
        const cell = formatSetsReps(group[0]!)
        const existing = rowMap.get(key)
        if (existing) {
          existing.weeks[weekIdx] = cell
          if (!existing.clarifications && clarifications) existing.clarifications = clarifications
        } else {
          const weeks: (string | null)[] = Array(weekCount).fill(null)
          weeks[weekIdx] = cell
          rowMap.set(key, { key, label, clarifications, weeks })
        }
      })
    })

    sections.push({
      dayKey,
      dayTitle: meta.title,
      warmupByWeek,
      blockNotesByWeek,
      rows: [...rowMap.values()],
    })
  }

  return sections
}

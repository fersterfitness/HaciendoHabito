import { parseExerciseMeta, pdfExerciseDisplay } from '@/lib/routine/exerciseMeta'
import type { Exercise, RoutineBlock, RoutineDay, RoutineExercise } from '@/types/database'

export type GuideBlockKind = 'circuit' | 'individual'

export type GuideExerciseRow = {
  key: string
  exerciseName: string
  /** series/reps/peso por semana (vacío si no hay series). */
  weeks: (string | null)[]
}

export type GuideBlock = {
  key: string
  kind: GuideBlockKind
  /** Circuito: aclaración de bloque; individual: descanso del ejercicio. */
  headerNotesByWeek: (string | null)[]
  exercises: GuideExerciseRow[]
}

export type GuideDaySection = {
  dayKey: string
  dayTitle: string
  blocks: GuideBlock[]
}

type Ex = RoutineExercise & { exercise?: Exercise }
type Day = RoutineDay & { exercises: Ex[] }
type Block = RoutineBlock & { days: Day[] }

function fmtKg(n: number): string {
  const r = Math.round(n * 10) / 10
  if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r))
  return String(r)
}

/** Formato guía: `3x12 / 10 KG` o `3x12 / SIN KG`; sin series → vacío. */
export function formatGuidePrescriptionCell(ex: Ex): string {
  if (ex.sets == null) return ''

  const scheme = ex.reps_scheme?.trim()
  let repsPart = ''
  if (scheme) repsPart = scheme
  else if (ex.reps_min != null && ex.reps_max != null) {
    repsPart =
      ex.reps_min === ex.reps_max ? String(ex.reps_min) : `${ex.reps_min}–${ex.reps_max}`
  }

  const setsPart = repsPart ? `${ex.sets}x${repsPart}` : String(ex.sets)
  const weight =
    ex.weight_kg != null && ex.weight_kg > 0 ? `${fmtKg(ex.weight_kg)} KG` : 'SIN KG'
  return `${setsPart} / ${weight}`
}

function exerciseLabel(ex: Ex): string {
  return ex.exercise?.name?.trim() || 'Ejercicio'
}

function blockKeyForGroup(group: Ex[]): string {
  const lead = group[0]!
  if (group.length > 1 && lead.is_superset && lead.superset_group != null) {
    return `ss-${lead.superset_group}`
  }
  return `ex-${lead.exercise_id}`
}

function exerciseRowKey(blockKey: string, ex: Ex): string {
  return `${blockKey}-${ex.exercise_id}`
}

function circuitClarification(group: Ex[]): string | null {
  for (const ex of group) {
    const { meta } = parseExerciseMeta(ex.technical_notes)
    const note = meta.circuitNote?.trim()
    if (note) return note
  }
  return null
}

function individualRestNote(ex: Ex): string | null {
  const display = pdfExerciseDisplay(ex).restDisplay
  if (!display || display === '—') return null
  return display
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
 * Guía por día: bloques CIRCUITO / INDIVIDUAL, un ejercicio por fila, sin calentamiento.
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
    const blockMap = new Map<string, GuideBlock>()
    const blockOrder: string[] = []

    const templateBlock = sortedBlocks
      .map((b) => b.days.find((d) => (d.day_name.trim() || `dia-${d.sort_order}`) === dayKey))
      .find(Boolean)

    if (templateBlock) {
      for (const group of orderedGroups(templateBlock)) {
        const bKey = blockKeyForGroup(group)
        if (blockMap.has(bKey)) continue
        blockOrder.push(bKey)
        const isCircuit = group.length > 1
        blockMap.set(bKey, {
          key: bKey,
          kind: isCircuit ? 'circuit' : 'individual',
          headerNotesByWeek: Array(weekCount).fill(null),
          exercises: group.map((ex) => ({
            key: exerciseRowKey(bKey, ex),
            exerciseName: exerciseLabel(ex),
            weeks: Array(weekCount).fill(null),
          })),
        })
      }
    }

    sortedBlocks.forEach((block, weekIdx) => {
      const day = block.days.find((d) => (d.day_name.trim() || `dia-${d.sort_order}`) === dayKey)
      if (!day) return

      for (const group of orderedGroups(day)) {
        const bKey = blockKeyForGroup(group)
        let guideBlock = blockMap.get(bKey)
        if (!guideBlock) {
          blockOrder.push(bKey)
          const isCircuit = group.length > 1
          guideBlock = {
            key: bKey,
            kind: isCircuit ? 'circuit' : 'individual',
            headerNotesByWeek: Array(weekCount).fill(null),
            exercises: [],
          }
          blockMap.set(bKey, guideBlock)
        }

        if (guideBlock.kind === 'circuit') {
          guideBlock.headerNotesByWeek[weekIdx] = circuitClarification(group)
        } else {
          guideBlock.headerNotesByWeek[weekIdx] = individualRestNote(group[0]!)
        }

        for (const ex of group) {
          const rowKey = exerciseRowKey(bKey, ex)
          let row = guideBlock.exercises.find((r) => r.key === rowKey)
          if (!row) {
            row = { key: rowKey, exerciseName: exerciseLabel(ex), weeks: Array(weekCount).fill(null) }
            guideBlock.exercises.push(row)
          }
          row.weeks[weekIdx] = formatGuidePrescriptionCell(ex)
        }
      }
    })

    sections.push({
      dayKey,
      dayTitle: meta.title,
      blocks: blockOrder.map((k) => blockMap.get(k)!).filter(Boolean),
    })
  }

  return sections
}

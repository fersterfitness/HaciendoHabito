import { parseExerciseMeta, pdfExerciseDisplay } from '@/lib/routine/exerciseMeta'
import type { Exercise, RoutineBlock, RoutineDay, RoutineExercise } from '@/types/database'

export type GuideBlockKind = 'circuit' | 'individual'

export type GuideExerciseRow = {
  key: string
  exerciseId: string
  exerciseName: string
  /** series/reps/peso por semana; vacío si no hay series. */
  weeks: (string | null)[]
}

export type GuideBlock = {
  key: string
  kind: GuideBlockKind
  sortOrder: number
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
export type ProgressGuideBlock = RoutineBlock & { days: Day[] }

export function buildGuideWeekLabels(blocks: ProgressGuideBlock[]): { label: string; dates: string | null }[] {
  return [...blocks]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((b, i) => ({
      label: b.name?.trim() || `Semana ${i + 1}`,
      dates:
        b.start_date || b.end_date
          ? `${b.start_date ? new Date(b.start_date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '?'} – ${b.end_date ? new Date(b.end_date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '?'}`
          : null,
    }))
}

/** Cantidad de series a filas de registro (1–5; default 3). */
export function exerciseSetsForWeek(
  blocks: ProgressGuideBlock[],
  dayKey: string,
  exerciseId: string,
  weekIdx: number,
): number {
  const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order)
  const block = sorted[weekIdx]
  if (!block) return 3
  const day = block.days.find((d) => (d.day_name.trim() || `dia-${d.sort_order}`) === dayKey)
  if (!day) return 3
  const ex = day.exercises.find((e) => e.exercise_id === exerciseId)
  const sets = ex?.sets
  if (sets != null && sets > 0) return Math.min(Math.max(sets, 1), 5)
  return 3
}

type Block = ProgressGuideBlock

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

/** Clave estable entre semanas aunque cambie superset_group. */
function blockKeyForGroup(group: Ex[]): string {
  const ids = [...group].sort((a, b) => a.sort_order - b.sort_order).map((e) => e.exercise_id)
  if (group.length > 1) return `circuit-${ids.join('-')}`
  return `ex-${ids[0]!}`
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

function orderedGroups(day: Day): { group: Ex[]; sortOrder: number }[] {
  const sorted = [...day.exercises].sort((a, b) => a.sort_order - b.sort_order)
  const result: { group: Ex[]; sortOrder: number }[] = []
  const seenCircuit = new Set<number>()

  for (const ex of sorted) {
    if (ex.is_superset && ex.superset_group != null) {
      if (seenCircuit.has(ex.superset_group)) continue
      seenCircuit.add(ex.superset_group)
      const group = sorted
        .filter((e) => e.is_superset && e.superset_group === ex.superset_group)
        .sort((a, b) => a.sort_order - b.sort_order)
      result.push({ group, sortOrder: group[0]!.sort_order })
    } else {
      result.push({ group: [ex], sortOrder: ex.sort_order })
    }
  }

  return result.sort((a, b) => a.sortOrder - b.sortOrder)
}

function isCircuitGroup(group: Ex[]): boolean {
  return group.length > 1
}

/** Si el circuitNote solo está en una semana, mostrarlo en todas. */
function propagateCircuitHeaderNotes(block: GuideBlock): void {
  if (block.kind !== 'circuit') return
  const note = block.headerNotesByWeek.find((n) => n?.trim())?.trim() ?? null
  if (!note) return
  block.headerNotesByWeek = block.headerNotesByWeek.map((n) => (n?.trim() ? n : note))
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

    const templateDay = sortedBlocks
      .map((b) => b.days.find((d) => (d.day_name.trim() || `dia-${d.sort_order}`) === dayKey))
      .find(Boolean)

    if (templateDay) {
      for (const { group, sortOrder } of orderedGroups(templateDay)) {
        const bKey = blockKeyForGroup(group)
        if (blockMap.has(bKey)) continue
        blockOrder.push(bKey)
        blockMap.set(bKey, {
          key: bKey,
          kind: isCircuitGroup(group) ? 'circuit' : 'individual',
          sortOrder,
          headerNotesByWeek: Array(weekCount).fill(null),
          exercises: [...group]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((ex) => ({
              key: exerciseRowKey(bKey, ex),
              exerciseId: ex.exercise_id,
              exerciseName: exerciseLabel(ex),
              weeks: Array(weekCount).fill(null),
            })),
        })
      }
    }

    sortedBlocks.forEach((block, weekIdx) => {
      const day = block.days.find((d) => (d.day_name.trim() || `dia-${d.sort_order}`) === dayKey)
      if (!day) return

      for (const { group, sortOrder } of orderedGroups(day)) {
        const bKey = blockKeyForGroup(group)
        let guideBlock = blockMap.get(bKey)
        if (!guideBlock) {
          blockOrder.push(bKey)
          guideBlock = {
            key: bKey,
            kind: isCircuitGroup(group) ? 'circuit' : 'individual',
            sortOrder,
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
            row = {
              key: rowKey,
              exerciseId: ex.exercise_id,
              exerciseName: exerciseLabel(ex),
              weeks: Array(weekCount).fill(null),
            }
            guideBlock.exercises.push(row)
          }
          row.weeks[weekIdx] = formatGuidePrescriptionCell(ex)
        }
      }
    })

    // Si un ejercicio cambió de bloque entre semanas, igual mostrar series/reps/peso.
    sortedBlocks.forEach((block, weekIdx) => {
      const day = block.days.find((d) => (d.day_name.trim() || `dia-${d.sort_order}`) === dayKey)
      if (!day) return
      const byExerciseId = new Map(day.exercises.map((ex) => [ex.exercise_id, ex]))
      for (const guideBlock of blockMap.values()) {
        for (const row of guideBlock.exercises) {
          if (row.weeks[weekIdx]?.trim()) continue
          const ex = byExerciseId.get(row.exerciseId)
          if (ex) row.weeks[weekIdx] = formatGuidePrescriptionCell(ex)
        }
      }
    })

    const blocksOut = blockOrder
      .map((k) => blockMap.get(k)!)
      .filter(Boolean)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    for (const b of blocksOut) propagateCircuitHeaderNotes(b)

    sections.push({
      dayKey,
      dayTitle: meta.title,
      blocks: blocksOut,
    })
  }

  return sections
}

import { formatSeriesPlanLine, parseExerciseMeta, pdfExerciseDisplay } from '@/lib/routine/exerciseMeta'
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

/** Cantidad de series en filas del registro de progreso (1–8). */
export function parseVueltasFromNote(note: string | null | undefined): number | null {
  if (!note?.trim()) return null
  const m = note.match(/(\d+)\s*vueltas?/i)
  if (!m) return null
  const n = parseInt(m[1]!, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Extrae N de prescripciones tipo `3x12 / …` o `2 / SIN KG`. */
export function parseSetsFromPrescription(prescription: string | null | undefined): number | null {
  if (!prescription?.trim()) return null
  const t = prescription.trim()
  const mx = t.match(/^(\d+)\s*x/i)
  if (mx) {
    const n = parseInt(mx[1]!, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const mSlash = t.match(/^(\d+)\s*\//)
  if (mSlash) {
    const n = parseInt(mSlash[1]!, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

function setsFromExerciseInWeek(
  blocks: ProgressGuideBlock[],
  dayKey: string,
  exerciseId: string,
  weekIdx: number,
): number | null {
  const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order)
  const block = sorted[weekIdx]
  if (!block) return null
  const day = block.days.find((d) => (d.day_name.trim() || `dia-${d.sort_order}`) === dayKey)
  if (!day) return null
  const ex = day.exercises.find((e) => e.exercise_id === exerciseId)
  if (ex?.sets != null && ex.sets > 0) return ex.sets
  return null
}

/** Filas de serie del registro: vueltas (circuito) → sets del ejercicio → prescripción → 2. */
export function exerciseLogSeriesCount(opts: {
  blocks: ProgressGuideBlock[]
  dayKey: string
  exerciseId: string
  weekIdx: number
  guideBlock: GuideBlock
  prescription: string | null
}): number {
  const { blocks, dayKey, exerciseId, weekIdx, guideBlock, prescription } = opts

  if (guideBlock.kind === 'circuit') {
    const vueltas = parseVueltasFromNote(guideBlock.headerNotesByWeek[weekIdx])
    if (vueltas != null) return Math.min(Math.max(vueltas, 1), 8)
  }

  const fromExercise = setsFromExerciseInWeek(blocks, dayKey, exerciseId, weekIdx)
  if (fromExercise != null) return Math.min(Math.max(fromExercise, 1), 8)

  const fromRx = parseSetsFromPrescription(prescription)
  if (fromRx != null) return Math.min(Math.max(fromRx, 1), 8)

  return 2
}

/** @deprecated Usar exerciseLogSeriesCount */
export function exerciseSetsForWeek(
  blocks: ProgressGuideBlock[],
  dayKey: string,
  exerciseId: string,
  weekIdx: number,
): number {
  return setsFromExerciseInWeek(blocks, dayKey, exerciseId, weekIdx) ?? 3
}

type Block = ProgressGuideBlock

function fmtKg(n: number): string {
  const r = Math.round(n * 10) / 10
  if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r))
  return String(r)
}

/** Formato guía: `3x12 / 10 KG` o `3x12 / SIN KG`; sin series → vacío. */
export function formatGuidePrescriptionCell(ex: Ex): string {
  // Multiarticulares con plan por serie: mostrar el detalle (kg/%/reps por serie).
  const { meta } = parseExerciseMeta(ex.technical_notes)
  const planLine = formatSeriesPlanLine(meta.seriesPlan)
  if (planLine) return planLine

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

/**
 * Clave estable entre semanas aunque cambie superset_group o el orden de los
 * ejercicios dentro del circuito. Los ids se ordenan de forma determinística para
 * que el mismo conjunto de ejercicios no genere dos bloques (evita circuitos duplicados).
 */
function blockKeyForGroup(group: Ex[]): string {
  if (group.length > 1) {
    const ids = group.map((e) => e.exercise_id).sort()
    return `circuit-${ids.join('-')}`
  }
  return `ex-${group[0]!.exercise_id}`
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
    // Cada ejercicio pertenece a UN solo bloque del día (su "hogar"), fijado en su
    // primera aparición. Las demás semanas vuelcan sus datos en ese mismo bloque,
    // aunque ahí estén agrupadas distinto (evita ejercicios/circuitos duplicados
    // cuando se copian semanas o días).
    const exerciseHome = new Map<string, string>()

    sortedBlocks.forEach((block, weekIdx) => {
      const day = block.days.find((d) => (d.day_name.trim() || `dia-${d.sort_order}`) === dayKey)
      if (!day) return

      for (const { group, sortOrder } of orderedGroups(day)) {
        // Si algún ejercicio del grupo ya tiene hogar, reusamos ese bloque.
        const homedKey = group.map((e) => exerciseHome.get(e.exercise_id)).find(Boolean)
        const bKey = homedKey ?? blockKeyForGroup(group)

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
          const existingHome = exerciseHome.get(ex.exercise_id)
          const target = existingHome ? blockMap.get(existingHome)! : guideBlock
          if (!existingHome) exerciseHome.set(ex.exercise_id, target.key)

          let row = target.exercises.find((r) => r.exerciseId === ex.exercise_id)
          if (!row) {
            row = {
              key: `${target.key}-${ex.exercise_id}`,
              exerciseId: ex.exercise_id,
              exerciseName: exerciseLabel(ex),
              weeks: Array(weekCount).fill(null),
            }
            target.exercises.push(row)
          }
          row.weeks[weekIdx] = formatGuidePrescriptionCell(ex)
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

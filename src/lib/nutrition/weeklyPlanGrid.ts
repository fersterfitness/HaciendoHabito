/** Modelo serializado en nutrition_week_schedules.grid y plantillas */

export interface MealRowModel {
  id: string
  label: string
  approxTime: string
  columns: string[]
}

export interface WeeklyPlanGridJson {
  mealRows: MealRowModel[]
}

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

export function columnLabels(mergeWeekends: boolean): string[] {
  if (mergeWeekends) return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb y Dom']
  return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
}

export function columnFullLabels(mergeWeekends: boolean): string[] {
  if (mergeWeekends) return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado y domingo']
  return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
}

export function columnCount(mergeWeekends: boolean): number {
  return mergeWeekends ? 6 : 7
}

export type DayAccent = { color: string; wash: string }

const WEEKDAY_ACCENTS: DayAccent[] = [
  { color: '#F97316', wash: '#FFF7ED' },
  { color: '#EAB308', wash: '#FEFCE8' },
  { color: '#14B8A6', wash: '#F0FDFA' },
  { color: '#8B5CF6', wash: '#F5F3FF' },
  { color: '#EC4899', wash: '#FDF2F8' },
  { color: '#3B82F6', wash: '#EFF6FF' },
  { color: '#22C55E', wash: '#F0FDF4' },
]

const WEEKEND_MERGED_ACCENT: DayAccent = { color: '#6366F1', wash: '#EEF2FF' }

export function dayAccent(index: number, mergeWeekends: boolean): DayAccent {
  if (mergeWeekends && index === 5) return WEEKEND_MERGED_ACCENT
  return WEEKDAY_ACCENTS[index] ?? WEEKDAY_ACCENTS[0]
}

export function filledMealCountForDay(grid: WeeklyPlanGridJson, dayIndex: number): number {
  return grid.mealRows.filter((row) => (row.columns[dayIndex] ?? '').trim().length > 0).length
}

export function mealContentLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•]\s*/, '').trim())
    .filter(Boolean)
}

export function isNoMealMarker(text: string): boolean {
  const t = text.trim().toLowerCase()
  return t === 'no hay' || t === 'n/a' || t === '-' || t === '—' || t === 'ninguno' || t === 'ninguna'
}

function foldEs(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Título corto para cards angostas (PDF / vista paciente). No cambia el dato guardado. */
export function compactMealLabel(label: string): string {
  const raw = label.trim()
  if (!raw) return raw
  const folded = foldEs(raw)
  if (!folded.includes('colacion')) return raw
  if (/media\s*tarde/.test(folded) || /vespertin/.test(folded)) return 'Colación PM'
  if (/media\s*manana/.test(folded) || /matutin|matinal/.test(folded) || /\bmanana\b/.test(folded)) {
    return 'Colación AM'
  }
  return raw
}

/** Parte párrafos largos para que una sola línea no estire una card. */
export function wrapLongLines(lines: string[], maxChars: number): string[] {
  if (maxChars < 8) return lines
  const out: string[] = []
  for (const line of lines) {
    if (line.length <= maxChars) {
      out.push(line)
      continue
    }
    let rest = line
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(' ', maxChars)
      if (cut < Math.floor(maxChars * 0.45)) cut = maxChars
      out.push(rest.slice(0, cut).trim())
      rest = rest.slice(cut).trim()
    }
    if (rest) out.push(rest)
  }
  return out
}

export function chunkLines(lines: string[], maxLines: number): string[][] {
  if (maxLines < 1) return [lines]
  if (lines.length === 0) return [[]]
  const chunks: string[][] = []
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines))
  }
  return chunks
}

/** Bandas de una comida: cada banda es un renglón de cards (un array de líneas por día). */
export function mealRowLineChunks(
  columns: string[],
  dayCount: number,
  opts: { maxChars: number; maxLines: number },
): string[][][] {
  const perDay = Array.from({ length: dayCount }, (_, d) => {
    const raw = columns[d] ?? ''
    if (!raw.trim() || isNoMealMarker(raw)) return [[]] as string[][]
    return chunkLines(wrapLongLines(mealContentLines(raw), opts.maxChars), opts.maxLines)
  })
  const bandCount = Math.max(1, ...perDay.map((chunks) => chunks.length))
  return Array.from({ length: bandCount }, (_, b) => perDay.map((chunks) => chunks[b] ?? []))
}

const DEFAULT_ROWS: Pick<MealRowModel, 'label' | 'approxTime'>[] = [
  { label: 'Desayuno', approxTime: '10:00' },
  { label: 'Almuerzo', approxTime: '13:00' },
  { label: 'Merienda', approxTime: '17:30' },
  { label: 'Cena', approxTime: '21:00' },
]

export function createEmptyWeeklyGrid(mergeWeekends: boolean): WeeklyPlanGridJson {
  const n = columnCount(mergeWeekends)
  return {
    mealRows: DEFAULT_ROWS.map((d) => ({
      id: newId(),
      label: d.label,
      approxTime: d.approxTime,
      columns: Array(n).fill(''),
    })),
  }
}

/** Garantiza longitud correcta por fila; si viene vacío, devuelve grilla nueva */
export function normalizeWeeklyGrid(parsed: unknown, mergeWeekends: boolean): WeeklyPlanGridJson {
  const n = columnCount(mergeWeekends)
  if (!parsed || typeof parsed !== 'object') return createEmptyWeeklyGrid(mergeWeekends)
  const raw = parsed as WeeklyPlanGridJson
  const rowsIn = Array.isArray(raw.mealRows) ? raw.mealRows : []

  const mealRows: MealRowModel[] =
    rowsIn.length === 0
      ? createEmptyWeeklyGrid(mergeWeekends).mealRows
      : rowsIn.map((row) => {
          const cols = Array.isArray(row.columns) ? [...row.columns] : []
          while (cols.length < n) cols.push('')
          cols.length = n
          return {
            id: typeof row.id === 'string' && row.id.length > 0 ? row.id : newId(),
            label: typeof row.label === 'string' ? row.label : 'Comida',
            approxTime: typeof row.approxTime === 'string' ? row.approxTime : '',
            columns: cols,
          }
        })

  return { mealRows }
}

export function reshapeGrid(grid: WeeklyPlanGridJson, fromMerge: boolean, toMerge: boolean): WeeklyPlanGridJson {
  if (fromMerge === toMerge) return normalizeWeeklyGrid(grid, toMerge)
  const fromN = columnCount(fromMerge)
  const toN = columnCount(toMerge)

  const mealRows = grid.mealRows.map((row) => {
    const cols = [...row.columns]
    while (cols.length < fromN) cols.push('')
    cols.length = fromN

    let nextCols: string[]
    if (!fromMerge && toMerge && fromN === 7) {
      const sat = cols[5] ?? ''
      const dom = cols[6] ?? ''
      const sep = sat && dom ? '\n\n— Domingo —\n\n' : ''
      nextCols = [...cols.slice(0, 5), sat + sep + dom]
    } else if (fromMerge && !toMerge && fromN === 6) {
      const weekend = cols[5] ?? ''
      nextCols = [...cols.slice(0, 5), weekend, weekend]
    } else {
      nextCols = cols.slice()
      while (nextCols.length < toN) nextCols.push('')
      nextCols.length = toN
    }

    return { ...row, columns: nextCols }
  })

  return normalizeWeeklyGrid({ mealRows }, toMerge)
}

export function addMealRow(grid: WeeklyPlanGridJson, mergeWeekends: boolean): WeeklyPlanGridJson {
  const n = columnCount(mergeWeekends)
  const mealRows = [
    ...grid.mealRows,
    {
      id: newId(),
      label: 'Comida',
      approxTime: '',
      columns: Array(n).fill(''),
    },
  ]
  return { mealRows }
}

export function removeMealRowAt(grid: WeeklyPlanGridJson, index: number): WeeklyPlanGridJson {
  const mealRows = grid.mealRows.filter((_, i) => i !== index)
  return mealRows.length > 0 ? { mealRows } : grid
}

/** Modelo serializado en nutrition_week_schedules.grid y plantillas */

/** Macros opcionales de una casilla (comida de un día). Gramos, salvo kcal. */
export interface MealMacros {
  kcal: number | null
  p: number | null
  c: number | null
  g: number | null
}

export interface MealRowModel {
  id: string
  label: string
  approxTime: string
  columns: string[]
  /** Paralelo a `columns`; sólo existe si se cargó algún macro (v2). */
  macros?: (MealMacros | null)[]
}

const MACRO_KEYS = ['kcal', 'p', 'c', 'g'] as const

function macroNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null
}

/** null si no hay ningún valor cargado. */
export function cleanMacros(raw: unknown): MealMacros | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const m: MealMacros = { kcal: macroNumber(r.kcal), p: macroNumber(r.p), c: macroNumber(r.c), g: macroNumber(r.g) }
  return MACRO_KEYS.some((k) => m[k] != null) ? m : null
}

/** Suma de los macros de un día (null si ninguna comida tiene macros). */
export function dayMacroTotals(grid: WeeklyPlanGridJson, dayIndex: number): MealMacros | null {
  let any = false
  const t: MealMacros = { kcal: null, p: null, c: null, g: null }
  for (const row of grid.mealRows) {
    const m = row.macros?.[dayIndex]
    if (!m) continue
    for (const k of MACRO_KEYS) {
      if (m[k] == null) continue
      any = true
      t[k] = Math.round(((t[k] ?? 0) + (m[k] as number)) * 10) / 10
    }
  }
  return any ? t : null
}

/** «450 kcal · P 30 g · C 50 g · G 12 g» (sólo lo cargado). */
export function formatMacros(m: MealMacros): string {
  const n = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 1 })
  return [
    m.kcal != null ? `${n(m.kcal)} kcal` : null,
    m.p != null ? `P ${n(m.p)} g` : null,
    m.c != null ? `C ${n(m.c)} g` : null,
    m.g != null ? `G ${n(m.g)} g` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function normalizeMacros(raw: unknown, n: number): (MealMacros | null)[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = Array.from({ length: n }, (_, i) => cleanMacros(raw[i]))
  return out.some(Boolean) ? out : undefined
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
          const macros = normalizeMacros(row.macros, n)
          return {
            id: typeof row.id === 'string' && row.id.length > 0 ? row.id : newId(),
            label: typeof row.label === 'string' ? row.label : 'Comida',
            approxTime: typeof row.approxTime === 'string' ? row.approxTime : '',
            columns: cols,
            ...(macros ? { macros } : {}),
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

    const mac = row.macros ? [...row.macros] : null
    if (mac) {
      while (mac.length < fromN) mac.push(null)
      mac.length = fromN
    }

    let nextCols: string[]
    let nextMac: (MealMacros | null)[] | null = null
    if (!fromMerge && toMerge && fromN === 7) {
      const sat = cols[5] ?? ''
      const dom = cols[6] ?? ''
      const sep = sat && dom ? '\n\n— Domingo —\n\n' : ''
      nextCols = [...cols.slice(0, 5), sat + sep + dom]
      // Sábado y domingo juntos: quedan los macros del sábado (o los del domingo si el sábado no tenía).
      if (mac) nextMac = [...mac.slice(0, 5), mac[5] ?? mac[6] ?? null]
    } else if (fromMerge && !toMerge && fromN === 6) {
      const weekend = cols[5] ?? ''
      nextCols = [...cols.slice(0, 5), weekend, weekend]
      if (mac) nextMac = [...mac.slice(0, 5), mac[5] ?? null, mac[5] ?? null]
    } else {
      nextCols = cols.slice()
      while (nextCols.length < toN) nextCols.push('')
      nextCols.length = toN
      if (mac) nextMac = mac
    }

    const { macros: _old, ...rest } = row
    void _old
    return nextMac ? { ...rest, columns: nextCols, macros: nextMac } : { ...rest, columns: nextCols }
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

/** Copia el menú y los macros de una casilla a otros días de la misma comida. */
export function copyMealCell(grid: WeeklyPlanGridJson, mealIdx: number, fromDay: number, toDays: number[]): WeeklyPlanGridJson {
  const row = grid.mealRows[mealIdx]
  if (!row) return grid
  const n = row.columns.length
  const columns = [...row.columns]
  const macros = Array.from({ length: n }, (_, i) => row.macros?.[i] ?? null)
  const srcMacros = macros[fromDay]
  for (const d of toDays) {
    if (d === fromDay || d < 0 || d >= n) continue
    columns[d] = row.columns[fromDay] ?? ''
    macros[d] = srcMacros ? { ...srcMacros } : null
  }
  const { macros: _old, ...rest } = row
  void _old
  const nextRow: MealRowModel = macros.some(Boolean) ? { ...rest, columns, macros } : { ...rest, columns }
  return { mealRows: grid.mealRows.map((r, i) => (i === mealIdx ? nextRow : r)) }
}

export function removeMealRowAt(grid: WeeklyPlanGridJson, index: number): WeeklyPlanGridJson {
  const mealRows = grid.mealRows.filter((_, i) => i !== index)
  return mealRows.length > 0 ? { mealRows } : grid
}

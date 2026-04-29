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

export function columnCount(mergeWeekends: boolean): number {
  return mergeWeekends ? 6 : 7
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

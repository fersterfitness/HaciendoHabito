import { addDays, format, parseISO } from 'date-fns'

type BlockSortable = { sort_order: number; end_date?: string | null }

/** Semana de entrenamiento: 7 días inclusive (inicio + 6). */
export function weekEndFromStart(startIso: string): string {
  return format(addDays(parseISO(startIso), 6), 'yyyy-MM-dd')
}

export function nextWeekStartAfter(endIso: string): string {
  return format(addDays(parseISO(endIso), 1), 'yyyy-MM-dd')
}

export type WeekBlockDatePatch = { id: string; start_date: string; end_date: string }

/**
 * Al cambiar fecha de inicio de una semana, recalcula fin (+6 días)
 * y propaga inicio/fin a las semanas siguientes (orden sort_order).
 */
export function cascadeWeekDatesFromBlock< T extends { id: string; sort_order: number } >(
  blocks: T[],
  changedBlockId: string,
  newStart: string,
): WeekBlockDatePatch[] {
  const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order)
  const idx = sorted.findIndex((b) => b.id === changedBlockId)
  if (idx < 0 || !newStart.trim()) return []

  const patches: WeekBlockDatePatch[] = []
  let cursorStart = newStart.trim()

  for (let i = idx; i < sorted.length; i++) {
    const end = weekEndFromStart(cursorStart)
    patches.push({ id: sorted[i].id, start_date: cursorStart, end_date: end })
    if (i + 1 < sorted.length) {
      cursorStart = nextWeekStartAfter(end)
    }
  }

  return patches
}

/**
 * Fechas sugeridas al agregar una semana nueva:
 * - Si ya hay semanas con fecha fin → empieza el día siguiente al último fin.
 * - Si no hay semanas pero la rutina tiene inicio → semana N desde esa fecha (+7 días por bloque previo).
 */
export function initialDatesForNewBlock(
  blocks: BlockSortable[],
  routineStartDate?: string | null,
): { start_date: string; end_date: string } | null {
  const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order)
  const last = sorted[sorted.length - 1]

  if (last?.end_date?.trim()) {
    const start = nextWeekStartAfter(last.end_date.trim())
    return { start_date: start, end_date: weekEndFromStart(start) }
  }

  const base = routineStartDate?.trim()
  if (!base) return null

  const weekIndex = sorted.length
  const start = format(addDays(parseISO(base), weekIndex * 7), 'yyyy-MM-dd')
  return { start_date: start, end_date: weekEndFromStart(start) }
}

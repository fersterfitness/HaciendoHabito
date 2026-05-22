import { addDays, format, parseISO } from 'date-fns'

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

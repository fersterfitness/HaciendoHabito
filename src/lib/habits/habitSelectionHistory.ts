/** Utilidades para estadísticas mensuales con historial asignación / borrador de hábitos. */

export type HabitSelectionEventRow = {
  id: string
  habit_id: string
  action: 'assigned' | 'removed'
  created_at: string
}

function endOfMonthTs(y: number, m: number): number {
  return new Date(y, m + 1, 0, 23, 59, 59, 999).getTime()
}

/** Hábitos activos hasta el fin del mes inclusivo según eventos ordenados ascendente por fecha. */
export function activeHabitIdsAtMonthEnd(eventsAsc: HabitSelectionEventRow[], y: number, m: number): Set<string> {
  const cutoff = endOfMonthTs(y, m)
  const ids = new Set<string>()
  for (const e of eventsAsc) {
    if (new Date(e.created_at).getTime() > cutoff) break
    if (e.action === 'assigned') ids.add(e.habit_id)
    else ids.delete(e.habit_id)
  }
  return ids
}

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const d = new Date(y, m + delta, 1)
  return { y: d.getFullYear(), m: d.getMonth() }
}

export type MonthlyHabitAgg = {
  key: string
  labelShort: string
  activeCount: number
  avgPct: number | null
}

const MONTH_LABELS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * últimos countMes meses hasta (endY,endM), promedio de % cumplimiento diario mensual sobre hábitos activos ese mes.
 */
export function buildMonthlyEvolutionPayload(
  endY: number,
  endM: number,
  monthCount: number,
  eventsAsc: HabitSelectionEventRow[],
  allLogsAsc: { habit_id: string; log_date: string }[],
  daysInMonthFn: (y: number, m: number) => number,
): MonthlyHabitAgg[] {
  const rows: MonthlyHabitAgg[] = []

  const logsByYm = (() => {
    const map = new Map<string, Map<string, number>>()
    for (const l of allLogsAsc) {
      const ym = l.log_date.slice(0, 7)
      let inner = map.get(ym)
      if (!inner) {
        inner = new Map()
        map.set(ym, inner)
      }
      inner.set(l.habit_id, (inner.get(l.habit_id) ?? 0) + 1)
    }
    return map
  })()

  for (let i = 0; i < monthCount; i++) {
    const { y, m } = addMonths(endY, endM, -(monthCount - 1 - i))
    const ym = `${y}-${String(m + 1).padStart(2, '0')}`
    const dm = daysInMonthFn(y, m)
    const replayed = activeHabitIdsAtMonthEnd(eventsAsc, y, m)

    let activeIds: Set<string>
    if (replayed.size > 0 || eventsAsc.length > 0) activeIds = replayed
    else {
      const inferred = logsByYm.get(ym)
      activeIds = new Set(inferred?.keys() ?? [])
    }

    let avgPct: number | null = null
    if (activeIds.size > 0 && dm > 0) {
      const doneMap = logsByYm.get(ym) ?? new Map()
      let sum = 0
      let n = 0
      for (const hid of activeIds) {
        const done = doneMap.get(hid) ?? 0
        sum += Math.min(100, Math.round((done / dm) * 100))
        n++
      }
      avgPct = n ? Math.round((sum / n) * 10) / 10 : null
    }

    rows.push({
      key: ym,
      labelShort: `${MONTH_LABELS_SHORT[m]} '${String(y).slice(2)}`,
      activeCount: activeIds.size,
      avgPct,
    })
  }

  return rows
}

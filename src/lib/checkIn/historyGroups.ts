/** Agrupa fechas de check-in en calendario de Argentina (año → mes). */

export function argentinaYearMonth(iso: string): { year: number; month: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  })
  const [y, m] = fmt.format(new Date(iso)).split('-').map(Number)
  return { year: y ?? 0, month: m ?? 1 }
}

export function monthLabelEs(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function groupByYearMonth<T>(items: T[], submittedAt: (item: T) => string): Map<number, Map<number, T[]>> {
  const years = new Map<number, Map<number, T[]>>()
  for (const item of items) {
    const { year, month } = argentinaYearMonth(submittedAt(item))
    if (!years.has(year)) years.set(year, new Map())
    const months = years.get(year)!
    if (!months.has(month)) months.set(month, [])
    months.get(month)!.push(item)
  }
  return years
}

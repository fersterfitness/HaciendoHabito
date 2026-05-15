/** Partes de calendario en una IANA TZ (para recordatorios semanales de check-in). */
export function getCalendarPartsInTimeZone(timeZone: string, date = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = dtf.formatToParts(date)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  const wdStr = parts.find((p) => p.type === 'weekday')?.value
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dayOfWeek = wdMap[wdStr ?? ''] ?? 0
  return { year, month, day, dayOfWeek }
}

export type ScheduleMatchInput = {
  is_enabled: boolean
  day_of_week: number
  timezone: string | null
}

/** ¿Hoy en `timezone` coincide con el día programado? (0=dom … 6=sáb, como JS). */
export function scheduleMatchesToday(schedule: ScheduleMatchInput): boolean {
  if (!schedule.is_enabled) return false
  const tz = schedule.timezone?.trim() || 'America/Argentina/Buenos_Aires'
  try {
    const { dayOfWeek } = getCalendarPartsInTimeZone(tz)
    return dayOfWeek === schedule.day_of_week
  } catch {
    return false
  }
}

export const WEEKDAY_LABELS_ES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

export const COMMON_TIMEZONES = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Argentina/Cordoba', label: 'Argentina (Córdoba)' },
  { value: 'America/Montevideo', label: 'Uruguay' },
  { value: 'America/Santiago', label: 'Chile' },
  { value: 'UTC', label: 'UTC' },
] as const

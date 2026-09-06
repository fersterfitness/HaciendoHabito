import { getCalendarPartsInTimeZone } from '@/lib/checkInSchedule'

/** Misma zona que los RPC de check-in en Supabase. */
export const CHECK_IN_SUBMISSION_TIMEZONE = 'America/Argentina/Buenos_Aires'

const TZ_UTC_OFFSET: Record<string, string> = {
  'America/Argentina/Buenos_Aires': '-03:00',
  'America/Argentina/Cordoba': '-03:00',
  'America/Montevideo': '-03:00',
  'America/Santiago': '-03:00',
  UTC: '+00:00',
}

/** Inicio de la semana calendaria (lunes 00:00) en la TZ del check-in. */
export function checkInWeekStartUtc(
  date = new Date(),
  timeZone = CHECK_IN_SUBMISSION_TIMEZONE,
): Date {
  const { dayOfWeek } = getCalendarPartsInTimeZone(timeZone, date)
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  let probe = date
  for (let i = 0; i < daysFromMonday; i++) {
    probe = new Date(probe.getTime() - 86_400_000)
  }
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(probe)
  const offset = TZ_UTC_OFFSET[timeZone] ?? '-03:00'
  return new Date(`${ymd}T00:00:00${offset}`)
}

/** Viernes 00:00 de la semana calendaria (lun–dom) del check-in. */
export function checkInFridayOfWeekUtc(
  date = new Date(),
  timeZone = CHECK_IN_SUBMISSION_TIMEZONE,
): Date {
  return new Date(checkInWeekStartUtc(date, timeZone).getTime() + 4 * 86_400_000)
}

function formatYmdInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Fecha YYYY-MM-DD del viernes de esa semana, en la TZ del check-in. */
export function checkInFridayYmd(
  date = new Date(),
  timeZone = CHECK_IN_SUBMISSION_TIMEZONE,
): string {
  return formatYmdInTimeZone(checkInFridayOfWeekUtc(date, timeZone), timeZone)
}

export function todayYmdInCheckInTz(
  date = new Date(),
  timeZone = CHECK_IN_SUBMISSION_TIMEZONE,
): string {
  return formatYmdInTimeZone(date, timeZone)
}

/** Mediodía AR para que un YYYY-MM-DD no se vaya al día anterior por UTC. */
export function parseCheckInYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00-03:00`)
}

export function addCalendarDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const cursor = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1))
  cursor.setUTCDate(cursor.getUTCDate() + days)
  const yy = cursor.getUTCFullYear()
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(cursor.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Lunes YYYY-MM-DD de la semana (lun–dom) que contiene `date`. */
export function checkInMondayYmd(
  date = new Date(),
  timeZone = CHECK_IN_SUBMISSION_TIMEZONE,
): string {
  return formatYmdInTimeZone(checkInWeekStartUtc(date, timeZone), timeZone)
}

/** Semana lun–dom de una fecha YYYY-MM-DD. El 5/09/2026 → lunes 31/08 al domingo 06/09. */
export function weekRangeContainingYmd(ymd: string): { startYmd: string; endYmd: string } {
  const startYmd = checkInMondayYmd(parseCheckInYmd(ymd))
  return { startYmd, endYmd: addCalendarDaysYmd(startYmd, 6) }
}

export function formatWeekRangeEs(ymd: string): string {
  const { startYmd, endYmd } = weekRangeContainingYmd(ymd)
  const fmt = (value: string) => {
    const [, m, d] = value.split('-')
    return `${d}/${m}`
  }
  return `lunes ${fmt(startYmd)} al domingo ${fmt(endYmd)}`
}

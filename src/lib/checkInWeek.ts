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

/** Fecha YYYY-MM-DD del viernes de esa semana, en la TZ del check-in. */
export function checkInFridayYmd(
  date = new Date(),
  timeZone = CHECK_IN_SUBMISSION_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(checkInFridayOfWeekUtc(date, timeZone))
}

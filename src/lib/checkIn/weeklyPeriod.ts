import { CHECK_IN_SUBMISSION_TIMEZONE, checkInFridayYmd } from '@/lib/checkInWeek'

const storageKey = (ownerId: string) => `hh-weekly-period-${ownerId}`

export function defaultWeeklyPeriodStartYmd(date = new Date()): string {
  return checkInFridayYmd(date)
}

export function loadWeeklyPeriodStartYmd(ownerId: string): string {
  try {
    const raw = localStorage.getItem(storageKey(ownerId))
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  } catch {
    /* ignore */
  }
  return defaultWeeklyPeriodStartYmd()
}

export function saveWeeklyPeriodStartYmd(ownerId: string, ymd: string): void {
  localStorage.setItem(storageKey(ownerId), ymd)
}

export function weeklyPeriodStartUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00-03:00`)
}

export function submittedInWeeklyPeriod(submittedAt: string, periodStartYmd: string): boolean {
  return new Date(submittedAt).getTime() >= weeklyPeriodStartUtc(periodStartYmd).getTime()
}

/** Suma días hábiles (lun–vie) a una fecha YYYY-MM-DD en Argentina. */
export function addBusinessDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const cursor = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1))
  let left = days
  while (left > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    const dow = cursor.getUTCDay()
    if (dow !== 0 && dow !== 6) left -= 1
  }
  const yy = cursor.getUTCFullYear()
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(cursor.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function weeklyPeriodDueYmd(periodStartYmd: string, businessDays = 3): string {
  return addBusinessDaysYmd(periodStartYmd, businessDays)
}

export function isWeeklyPeriodOverdue(periodStartYmd: string, now = new Date()): boolean {
  const due = weeklyPeriodStartUtc(weeklyPeriodDueYmd(periodStartYmd))
  return now.getTime() >= due.getTime()
}

export function formatPeriodYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('es-AR', {
    timeZone: CHECK_IN_SUBMISSION_TIMEZONE,
    day: '2-digit',
    month: 'short',
  })
}

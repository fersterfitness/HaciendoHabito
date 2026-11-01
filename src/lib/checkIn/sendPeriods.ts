/**
 * Semanas del feedback semanal según el día de envío (viernes por defecto): cada respuesta
 * pertenece a la semana del formulario que contesta, no al día en que la manda el alumno.
 * Misma regla que `hh_check_in_period` en la base (migración oct6).
 */

import { addCalendarDaysYmd, todayYmdInCheckInTz } from '@/lib/checkInWeek'

export const DEFAULT_SEND_DOW = 5

function dowOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

/** Último día de envío en o antes de la fecha (YYYY-MM-DD). */
export function sendDayOnOrBefore(ymd: string, sendDow = DEFAULT_SEND_DOW): string {
  return addCalendarDaysYmd(ymd, -((dowOf(ymd) - sendDow + 7) % 7))
}

/** Semana del formulario de una respuesta: la guardada o, en respuestas viejas, la del día en que llegó. */
export function responsePeriod(r: { period_start?: string | null; submitted_at: string }, sendDow = DEFAULT_SEND_DOW): string {
  if (r.period_start) return r.period_start.slice(0, 10)
  return sendDayOnOrBefore(todayYmdInCheckInTz(new Date(r.submitted_at)), sendDow)
}

/** Las últimas `count` semanas (la actual primero). */
export function recentPeriods(count: number, sendDow = DEFAULT_SEND_DOW, now = new Date()): string[] {
  const current = sendDayOnOrBefore(todayYmdInCheckInTz(now), sendDow)
  return Array.from({ length: count }, (_, i) => addCalendarDaysYmd(current, -7 * i))
}

/**
 * Semanas que el alumno quedó debiendo entre las recientes (sin contar la actual, que todavía está
 * en curso) y sin ir antes de su alta.
 */
export function owedPeriods(opts: { answered: Set<string>; periods: string[]; since?: string | null }): string[] {
  const { answered, periods, since } = opts
  return periods.slice(1).filter((p) => !answered.has(p) && (!since || p >= since.slice(0, 10)))
}

/** Link del formulario para una semana puntual (vacío = la actual). */
export function periodFormUrl(baseUrl: string, period?: string | null): string {
  if (!period) return baseUrl
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}semana=${period}`
}

/** «vie 23/10» */
export function periodLabel(ymd: string): string {
  const [, m, d] = ymd.split('-')
  const day = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][dowOf(ymd)]
  return `${day} ${d}/${m}`
}

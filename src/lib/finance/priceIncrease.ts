/** Aumento periódico de precios (cuotas de alumnos y planes de la web). Funciones puras. */

export type PriceIncreaseSettings = {
  percent: number
  every_months: number
  /** Día en que arranca el próximo aumento (YYYY-MM-DD, normalmente un 1°). */
  next_date: string | null
  apply_students: boolean
  apply_web_plans: boolean
  /** Redondeo de los montos nuevos (100 = a la centena). */
  round_to: number
  /** Planes web a los que se aplica (null = todos los activos). */
  web_plan_slugs: string[] | null
  /** Aviso al grupo ya copiado para este `next_date`. */
  notice_copied_for: string | null
}

export const DEFAULT_PRICE_INCREASE: PriceIncreaseSettings = {
  percent: 3,
  every_months: 3,
  next_date: null,
  apply_students: true,
  apply_web_plans: true,
  round_to: 100,
  web_plan_slugs: null,
  notice_copied_for: null,
}

/** Días antes del aumento en que sale el aviso para el grupo. */
export const NOTICE_DAYS_BEFORE = 15

export function increaseAmount(amount: number, percent: number, roundTo: number): number {
  const raw = amount * (1 + percent / 100)
  const step = roundTo > 0 ? roundTo : 1
  return Math.round(raw / step) * step
}

/**
 * Aumenta el número de una etiqueta de precio («$80.000» → «$82.400») conservando el formato.
 * Devuelve null si la etiqueta no tiene un monto reconocible.
 */
export function increasePriceLabel(label: string | null | undefined, percent: number, roundTo: number): string | null {
  if (!label) return null
  const m = /(\d{1,3}(?:\.\d{3})+|\d+)/.exec(label)
  if (!m) return null
  const value = Number(m[1].replace(/\./g, ''))
  if (!Number.isFinite(value) || value <= 0) return null
  const next = increaseAmount(value, percent, value >= 1000 ? roundTo : 1)
  return label.slice(0, m.index) + next.toLocaleString('es-AR', { maximumFractionDigits: 0 }) + label.slice(m.index + m[1].length)
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Próximo aumento: la misma fecha + N meses. */
export function addMonthsYmd(date: string, months: number): string {
  const d = parseYmd(date)
  return ymd(new Date(d.getFullYear(), d.getMonth() + months, d.getDate()))
}

/** Primer día del mes siguiente a `today` (sugerencia para el primer aumento). */
export function firstOfNextMonth(today: Date): string {
  return ymd(new Date(today.getFullYear(), today.getMonth() + 1, 1))
}

/**
 * Qué mostrar hoy:
 * - notice: faltan 15 días o menos → copiar el aviso para el grupo.
 * - due: llegó la fecha → aplicar el aumento.
 */
export function priceIncreaseStage(nextDate: string | null, today: Date): { stage: 'notice' | 'due' | null; daysLeft: number } {
  if (!nextDate) return { stage: null, daysLeft: Infinity }
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const daysLeft = Math.round((parseYmd(nextDate).getTime() - t.getTime()) / 86_400_000)
  if (daysLeft <= 0) return { stage: 'due', daysLeft }
  if (daysLeft <= NOTICE_DAYS_BEFORE) return { stage: 'notice', daysLeft }
  return { stage: null, daysLeft }
}

/** «1 de diciembre» */
export function longDayMonth(date: string): string {
  return parseYmd(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

/** Aviso al grupo general (texto del entrenador). */
export function priceIncreaseNoticeMessage(startDate: string): string {
  return `¡Hola a todos! 👋 Les escribo con tiempo para avisarles algo importante: el mes que viene la rutina va a tener un aumento en el pago.
Quería contárselo con 15 días de anticipación para que lo tengan en cuenta y puedan organizarse. Arranca el ${longDayMonth(startDate)}.
Como cada uno tiene su plan y su objetivo, el monto no es igual para todos. Si alguien tiene dudas, me manda mensaje directo y CUALQUIER SITUACIÓN ES CHARLABLE.
¡Gracias por entrenar conmigo y por la confianza de siempre! 💪. A SEGUIR HACIÉNDOLO HÁBITO`
}

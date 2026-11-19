import { z } from 'zod'

/**
 * Día de pago elegido en el formulario. Viaja como primera línea de «Dato de pago» (así llega sin
 * cambiar el envío) y la base lo copia al día de pago del alumno (SQL 20261123120000).
 */
export const PAY_DAY_RE = /^Prefiere pagar el (?:día (\d{1,2})|(último) día) de cada mes\.\n?/

/** `''` sin elegir · `'1'`…`'28'` · `'ultimo'` (último día del mes). */
export type PreferredPayDay = string

export function withPreferredPayDay(notes: string, day: PreferredPayDay): string {
  const rest = notes.replace(PAY_DAY_RE, '')
  if (!day) return rest
  const line = day === 'ultimo' ? 'Prefiere pagar el último día de cada mes.' : `Prefiere pagar el día ${day} de cada mes.`
  return rest ? `${line}\n${rest}` : line
}

/** Lo elegido, leído de «Dato de pago». */
export function preferredPayDayOf(notes: string | null | undefined): PreferredPayDay {
  const m = PAY_DAY_RE.exec(notes ?? '')
  if (!m) return ''
  return m[2] ? 'ultimo' : m[1]!
}

/** Feedback nov19: la fecha de pago es obligatoria en el formulario nuevo. */
export const paymentNotesSchema = z
  .string()
  .max(500)
  .refine((v) => PAY_DAY_RE.test(v), { message: 'Elegí qué día del mes vas a pagar' })

/**
 * Modo consultorio: la fila de turnos de hoy, quién sigue después de la consulta actual y el
 * resumen del día. Funciones puras; las consultas a la base están en los componentes.
 */

export type DayAppointment = {
  id: string
  student_id: string | null
  starts_at: string
  status: string
  full_name: string
}

const ACTIVE = new Set(['scheduled', 'confirmed'])

/** El turno de hoy de este paciente que se está atendiendo (el más cercano a ahora, sin cancelar). */
export function currentAppointmentFor(queue: DayAppointment[], studentId: string, now: Date): DayAppointment | null {
  const mine = queue.filter((a) => a.student_id === studentId && a.status !== 'cancelled' && a.status !== 'no_show')
  if (!mine.length) return null
  return [...mine].sort((a, b) => Math.abs(new Date(a.starts_at).getTime() - now.getTime()) - Math.abs(new Date(b.starts_at).getTime() - now.getTime()))[0]!
}

/**
 * Quién sigue: el primer turno activo de hoy de otro paciente que todavía no se atendió, empezando
 * después del actual (o, si no hay actual, el primero pendiente).
 */
export function nextAppointmentAfter(queue: DayAppointment[], current: DayAppointment | null, studentId: string): DayAppointment | null {
  const sorted = [...queue].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const pending = sorted.filter((a) => ACTIVE.has(a.status) && a.student_id && a.student_id !== studentId)
  if (!current) return pending[0] ?? null
  return pending.find((a) => a.starts_at >= current.starts_at) ?? pending[0] ?? null
}

export type DaySummary = {
  total: number
  attended: number
  /** Turnos de hoy que siguen agendados y ya pasaron (ni atendidos ni marcados ausentes). */
  unmarked: number
  remaining: number
  collected: number
  pendingCharges: number
}

/** Resumen del día: solo tiene sentido cuando ya no queda ningún turno por delante. */
export function summarizeDay(
  queue: DayAppointment[],
  incomesToday: { amount: number; status: string }[],
  now: Date,
): DaySummary {
  const live = queue.filter((a) => a.status !== 'cancelled')
  const attended = live.filter((a) => a.status === 'completed').length
  const open = live.filter((a) => ACTIVE.has(a.status))
  const remaining = open.filter((a) => new Date(a.starts_at).getTime() > now.getTime()).length
  return {
    total: live.length,
    attended,
    unmarked: open.length - remaining,
    remaining,
    collected: incomesToday.filter((i) => i.status === 'cobrado').reduce((s, i) => s + Number(i.amount || 0), 0),
    pendingCharges: incomesToday.filter((i) => i.status === 'pendiente').length,
  }
}

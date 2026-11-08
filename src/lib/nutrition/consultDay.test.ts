import { describe, expect, it } from 'vitest'
import { currentAppointmentFor, nextAppointmentAfter, summarizeDay, type DayAppointment } from './consultDay'

const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m).toISOString()
const a = (id: string, h: number, status = 'scheduled', student = id): DayAppointment => ({ id, student_id: student, starts_at: at(h), status, full_name: id })
const now = new Date(2026, 10, 9, 10, 10)

describe('modo consultorio', () => {
  const queue = [a('p3', 12), a('p1', 9, 'completed'), a('p2', 10), a('p4', 11, 'cancelled'), a('p5', 13)]

  it('toma el turno de hoy del paciente más cercano a ahora', () => {
    expect(currentAppointmentFor(queue, 'p2', now)?.id).toBe('p2')
    expect(currentAppointmentFor(queue, 'p4', now)).toBeNull()
  })

  it('el siguiente es el próximo turno activo de otro paciente', () => {
    const cur = currentAppointmentFor(queue, 'p2', now)
    expect(nextAppointmentAfter(queue, cur, 'p2')?.id).toBe('p3')
    // Sin turno actual (consulta fuera de agenda): el primero pendiente.
    expect(nextAppointmentAfter(queue, null, 'zz')?.id).toBe('p2')
    // El último del día no tiene siguiente… salvo alguno anterior que quedó sin atender.
    const last = currentAppointmentFor(queue, 'p5', now)
    expect(nextAppointmentAfter(queue, last, 'p5')?.id).toBe('p2')
    expect(nextAppointmentAfter([a('p1', 9, 'completed'), a('p5', 13)], last, 'p5')).toBeNull()
  })

  it('resume el día', () => {
    const s = summarizeDay(queue, [{ amount: 1000, status: 'cobrado' }, { amount: 500, status: 'cobrado' }, { amount: 800, status: 'pendiente' }], now)
    expect(s).toEqual({ total: 4, attended: 1, unmarked: 1, remaining: 2, collected: 1500, pendingCharges: 1 })
  })
})

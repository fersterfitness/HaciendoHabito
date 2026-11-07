import { describe, expect, it } from 'vitest'
import { buildNutritionistToday, startsInText, tomorrowReminderMessage, type TodayAppointment } from './nutritionistToday'

const now = new Date(2026, 10, 9, 10, 0)
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString()
const appt = (id: string, starts_at: string, full_name = 'Ana Pérez'): TodayAppointment => ({
  id,
  student_id: id,
  starts_at,
  ends_at: null,
  status: 'scheduled',
  title: null,
  full_name,
  phone: null,
})
const base = {
  withFutureAppointment: new Set<string>(),
  checkins: [],
  patients: [],
  overdueControls: [],
  pendingAnamnesis: [],
  reminded: new Set<string>(),
  now,
}

describe('buildNutritionistToday', () => {
  it('toma la consulta en curso como la próxima y separa las de mañana', () => {
    const t = buildNutritionistToday({
      ...base,
      appointments: [appt('c', at(9, 15)), appt('a', at(9, 8)), appt('b', at(9, 9, 30)), appt('m', at(10, 11)), appt('x', at(10, 12)), { ...appt('k', at(10, 13)), status: 'confirmed' }],
      reminded: new Set(['x']),
    })
    expect(t.next?.id).toBe('b')
    expect(t.nextInProgress).toBe(true)
    expect(t.laterToday.map((a) => a.id)).toEqual(['c'])
    expect(t.tomorrow.map((a) => a.id)).toEqual(['m'])
  })

  it('marca malestar o baja adherencia solo del último registro reciente, y saca controles con turno', () => {
    const t = buildNutritionistToday({
      ...base,
      appointments: [],
      patients: [
        { id: 'p1', full_name: 'Ana', phone: null },
        { id: 'p2', full_name: 'Bruno', phone: null },
        { id: 'p3', full_name: 'Carla', phone: null },
      ],
      checkins: [
        { student_id: 'p1', logged_at: '2026-11-01', digestive_discomfort_0_10: 9, adherence_1_5: 4 },
        { student_id: 'p1', logged_at: '2026-11-07', digestive_discomfort_0_10: 2, adherence_1_5: 4 },
        { student_id: 'p2', logged_at: '2026-11-08', digestive_discomfort_0_10: 8, adherence_1_5: 2 },
        { student_id: 'p3', logged_at: '2026-10-01', digestive_discomfort_0_10: 9, adherence_1_5: 1 },
      ],
      overdueControls: [
        { id: 'p1', full_name: 'Ana', detail: '' },
        { id: 'p2', full_name: 'Bruno', detail: '' },
      ],
      withFutureAppointment: new Set(['p2']),
    })
    expect(t.symptoms.map((s) => [s.id, s.detail])).toEqual([['p2', 'Malestar 8/10 · adherencia 2/5']])
    expect(t.overdue.map((p) => p.id)).toEqual(['p1'])
  })
})

describe('textos', () => {
  it('cuenta regresiva', () => {
    expect(startsInText(at(9, 10, 25), now)).toBe('en 25 min')
    expect(startsInText(at(9, 11, 10), now)).toBe('en 1 h 10 min')
    expect(startsInText(at(9, 9, 55), now)).toBe('empezó hace 5 min')
  })
  it('recordatorio con nombre y hora', () => {
    expect(tomorrowReminderMessage('Ana Pérez', at(10, 15, 30))).toBe('Hola Ana, te recuerdo tu consulta de mañana a las 15:30. ¿Me confirmás si venís? Gracias.')
  })
})

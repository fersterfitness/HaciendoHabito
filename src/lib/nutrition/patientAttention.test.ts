import { describe, expect, it } from 'vitest'
import { buildAttention } from './patientAttention'

const now = new Date(2026, 10, 6, 9, 0)
const patients = [
  { id: 'a', full_name: 'Ana', lastControlDate: '2026-08-01' },
  { id: 'b', full_name: 'Bruno', lastControlDate: '2026-08-01' },
  { id: 'c', full_name: 'Carla', lastControlDate: '2026-10-30' },
  { id: 'd', full_name: 'Dario', lastControlDate: null },
]

describe('buildAttention', () => {
  it('ordena por urgencia y deja a cada paciente en un solo grupo', () => {
    const items = buildAttention({
      patients,
      appointments: [{ student_id: 'c', starts_at: new Date(2026, 10, 6, 15, 30).toISOString() }],
      checkins: [
        { student_id: 'c', logged_at: '2026-11-01', digestive_discomfort_0_10: 8, adherence_1_5: 4 },
        { student_id: 'a', logged_at: '2026-10-01', digestive_discomfort_0_10: 9, adherence_1_5: 1 },
        { student_id: 'a', logged_at: '2026-11-02', digestive_discomfort_0_10: 2, adherence_1_5: 4 },
      ],
      overduePayments: new Set(['b', 'zz']),
      overdueControlDays: 42,
      now,
    })
    expect(items.map((i) => [i.id, i.kind])).toEqual([
      ['c', 'hoy'],
      ['b', 'pago'],
      ['a', 'control'],
    ])
    expect(items[0]!.detail).toMatch(/15:30/)
    expect(items[0]!.extra).toEqual(['Malestar 8/10'])
    expect(items[1]!.extra[0]).toMatch(/semanas/)
  })

  it('un control atrasado con turno ya agendado no hace falta marcarlo', () => {
    const items = buildAttention({
      patients,
      appointments: [{ student_id: 'a', starts_at: new Date(2026, 10, 20, 10).toISOString() }],
      checkins: [],
      overduePayments: new Set(),
      overdueControlDays: 42,
      now,
    })
    expect(items.map((i) => i.id)).toEqual(['b'])
  })
})

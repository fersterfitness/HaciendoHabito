import { describe, expect, it } from 'vitest'
import { countTrainingWeeks, rmTestBaseline } from '@/lib/checkIn/rmTestReminder'

describe('countTrainingWeeks', () => {
  it('cuenta una vez por semana calendario', () => {
    const ats = ['2026-10-05T12:00:00Z', '2026-10-07T12:00:00Z', '2026-10-13T12:00:00Z']
    expect(countTrainingWeeks(ats, null)).toBe(2)
  })

  it('ignora los check-ins anteriores a la base', () => {
    const ats = ['2026-09-01T12:00:00Z', '2026-09-20T12:00:00Z', '2026-10-13T12:00:00Z']
    expect(countTrainingWeeks(ats, '2026-09-10T00:00:00Z')).toBe(2)
  })

  it('suma semanas de varias rutinas hasta 12', () => {
    const ats = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 0, 5 + i * 7, 12)).toISOString())
    expect(countTrainingWeeks(ats, null)).toBe(12)
  })
})

describe('rmTestBaseline', () => {
  it('toma lo más reciente entre leído y último test', () => {
    expect(rmTestBaseline('2026-09-01T10:00:00Z', '2026-09-20')).toBe('2026-09-20T23:59:59')
    expect(rmTestBaseline('2026-10-01T10:00:00Z', '2026-09-20')).toBe('2026-10-01T10:00:00Z')
  })

  it('sin datos cuenta desde siempre', () => {
    expect(rmTestBaseline(null, null)).toBeNull()
  })
})

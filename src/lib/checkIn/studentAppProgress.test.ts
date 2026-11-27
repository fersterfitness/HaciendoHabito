import { describe, expect, it } from 'vitest'
import { EMPTY_DAY_LOG, type DayLog } from '@/lib/routine/studentTrainingLog'
import { bucketKey, logDate, notesFromDays, periodStart, progressBuckets, scaleTone, type ProgressDay } from './studentAppProgress'

const day = (date: string, log: Partial<DayLog>): ProgressDay => ({ date, routineName: 'Rutina', log: { ...EMPTY_DAY_LOG, ...log } })

describe('progreso del alumno en la ficha', () => {
  it('fecha del registro: la del cierre, si no la del chequeo', () => {
    expect(logDate({ status_date: '2026-11-10', checkin_at: '2026-11-09T10:00:00Z' })).toBe('2026-11-10')
    expect(logDate({ status_date: null, checkin_at: '2026-11-09T10:00:00Z' })).toBe('2026-11-09')
    expect(logDate({ status_date: null, checkin_at: null })).toBeNull()
  })

  it('agrupa por semana (lunes), mes y año', () => {
    expect(bucketKey('2026-11-12', 'week')).toBe('2026-11-09')
    expect(bucketKey('2026-11-09', 'week')).toBe('2026-11-09')
    expect(bucketKey('2026-11-12', 'month')).toBe('2026-11')
    expect(bucketKey('2026-11-12', 'year')).toBe('2026')
    expect(periodStart('day', new Date('2026-11-30T12:00:00'))).toBe('2026-11-01')
    expect(periodStart('year', new Date())).toBeNull()
  })

  it('promedia escalas, cuenta días y dolores por período', () => {
    const days = [
      day('2026-11-10', { energy: 4, stress: 2, status: 'done', effort: 8 }),
      day('2026-11-11', { energy: 2, status: 'missed', missed_reason: 'Viaje' }),
      day('2026-11-17', { energy: 5, pain_kind: 'unusual', pain_areas: ['gluteo'], status: 'done', effort: 6 }),
      day('2026-10-01', { energy: 1, status: 'done' }),
    ]
    const weeks = progressBuckets(days, 'week', '2026-11-01')
    expect(weeks.map((w) => w.key)).toEqual(['2026-11-09', '2026-11-16'])
    expect(weeks[0]).toMatchObject({ done: 1, missed: 1, effort: 8 })
    expect(weeks[0]!.averages.energy).toBe(3)
    expect(weeks[0]!.averages.stress).toBe(2)
    expect(weeks[1]).toMatchObject({ unusualPain: 1, done: 1 })
    expect(progressBuckets(days, 'year', null)).toHaveLength(1)
  })

  it('arma las aclaraciones: dolor, día sin entrenar, alimentación y nota del chequeo', () => {
    const notes = notesFromDays([
      day('2026-11-10', { pain_kind: 'unusual', pain_note: 'Pinchazo', status: 'missed', missed_reason: 'Dolor', nutrition_issue: 'ate_out', checkin_note: 'Cansado', sleep_hours: 'lt5' }),
    ])
    expect(notes.map((n) => n.kind)).toEqual(['pain', 'missed', 'nutrition', 'checkin'])
    expect(notes[0]!.text).toContain('Pinchazo')
    expect(notes[2]!.text).toBe('Comí afuera')
    expect(notes[3]!.text).toContain('Durmió: Menos de 5 h')
  })
})

describe('grilla semana a semana (nov27, 4b)', () => {
  it('lee el promedio a favor del alumno', () => {
    expect(scaleTone(4.5, 'high')).toBe('good')
    expect(scaleTone(3, 'high')).toBe('mid')
    expect(scaleTone(2, 'high')).toBe('low')
    expect(scaleTone(1.5, 'low')).toBe('good')
    expect(scaleTone(4.5, 'low')).toBe('low')
    expect(scaleTone(null, 'high')).toBeNull()
  })
})

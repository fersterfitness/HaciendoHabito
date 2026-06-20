import { describe, expect, it } from 'vitest'
import {
  coachMessageForWeekBlock,
  coachMessagesForDateRange,
  cycleDayOnDate,
  routinePhaseForCycleDay,
} from './menstrualCyclePlanning'

describe('menstrualCyclePlanning', () => {
  it('calcula día de ciclo desde el inicio', () => {
    expect(cycleDayOnDate('2026-06-02', '2026-06-02')).toBe(1)
    expect(cycleDayOnDate('2026-06-02', '2026-06-07')).toBe(6)
  })

  it('asigna fases según ventanas pedidas (1–5 / 6–14 / 15–19 / 20+)', () => {
    expect(routinePhaseForCycleDay(3, 28)).toBe('menstruacion')
    expect(routinePhaseForCycleDay(5, 28)).toBe('menstruacion')
    expect(routinePhaseForCycleDay(10, 28)).toBe('folicular')
    expect(routinePhaseForCycleDay(14, 28)).toBe('folicular')
    expect(routinePhaseForCycleDay(17, 28)).toBe('ovulacion')
    expect(routinePhaseForCycleDay(24, 28)).toBe('lutea')
  })

  it('mensaje para semana que cae en menstruación', () => {
    const msg = coachMessageForWeekBlock('2026-06-02', 28, '2026-06-02', '2026-06-06')
    expect(msg).toContain('Menstruando')
  })

  it('puede combinar varias fases en una semana larga', () => {
    const lines = coachMessagesForDateRange('2026-06-02', 28, '2026-06-02', '2026-06-16')
    expect(lines.some((l) => l.includes('Menstruando'))).toBe(true)
    expect(lines.some((l) => l.includes('folicular'))).toBe(true)
  })
})

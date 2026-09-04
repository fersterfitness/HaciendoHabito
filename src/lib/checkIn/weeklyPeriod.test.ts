import { describe, expect, it } from 'vitest'
import {
  addBusinessDaysYmd,
  isWeeklyPeriodOverdue,
  submittedInWeeklyPeriod,
  weeklyPeriodDueYmd,
} from '@/lib/checkIn/weeklyPeriod'

describe('weeklyPeriod', () => {
  it('viernes + 3 hábiles cae el miércoles siguiente', () => {
    expect(addBusinessDaysYmd('2026-09-04', 3)).toBe('2026-09-09')
    expect(weeklyPeriodDueYmd('2026-09-04')).toBe('2026-09-09')
  })

  it('una respuesta de la semana pasada no cuenta en el período nuevo', () => {
    expect(submittedInWeeklyPeriod('2026-08-28T18:00:00-03:00', '2026-09-04')).toBe(false)
    expect(submittedInWeeklyPeriod('2026-09-05T10:00:00-03:00', '2026-09-04')).toBe(true)
  })

  it('está vencido después de 3 días hábiles', () => {
    expect(isWeeklyPeriodOverdue('2026-09-04', new Date('2026-09-08T12:00:00-03:00'))).toBe(false)
    expect(isWeeklyPeriodOverdue('2026-09-04', new Date('2026-09-09T08:00:00-03:00'))).toBe(true)
  })
})

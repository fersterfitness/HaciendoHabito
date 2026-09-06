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

  it('el 5/09 cuenta la semana del lunes 31/08, no la próxima', () => {
    expect(submittedInWeeklyPeriod('2026-09-04T18:00:00-03:00', '2026-09-05')).toBe(true)
    expect(submittedInWeeklyPeriod('2026-08-31T08:00:00-03:00', '2026-09-05')).toBe(true)
    expect(submittedInWeeklyPeriod('2026-09-07T08:00:00-03:00', '2026-09-05')).toBe(false)
  })

  it('está vencido después de 3 días hábiles', () => {
    expect(isWeeklyPeriodOverdue('2026-09-04', new Date('2026-09-08T12:00:00-03:00'))).toBe(false)
    expect(isWeeklyPeriodOverdue('2026-09-04', new Date('2026-09-09T08:00:00-03:00'))).toBe(true)
  })
})

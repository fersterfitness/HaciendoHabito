import { describe, expect, it } from 'vitest'
import { formatWeekRangeEs, weekRangeContainingYmd } from '@/lib/checkInWeek'

describe('weekRangeContainingYmd', () => {
  it('5/09/2026 es la semana del lunes 31/08, no la siguiente', () => {
    expect(weekRangeContainingYmd('2026-09-05')).toEqual({
      startYmd: '2026-08-31',
      endYmd: '2026-09-06',
    })
    expect(formatWeekRangeEs('2026-09-05')).toBe('lunes 31/08 al domingo 06/09')
  })
})

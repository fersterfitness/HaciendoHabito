import { describe, expect, it } from 'vitest'
import { argentinaYearMonth, groupByYearMonth, monthLabelEs } from '@/lib/checkIn/historyGroups'

describe('historyGroups', () => {
  it('usa calendario de Argentina', () => {
    expect(argentinaYearMonth('2026-08-27T15:00:00-03:00')).toEqual({ year: 2026, month: 8 })
  })

  it('agrupa año → mes', () => {
    const grouped = groupByYearMonth(
      [
        { id: 'a', at: '2026-08-27T12:00:00-03:00' },
        { id: 'b', at: '2026-01-05T12:00:00-03:00' },
        { id: 'c', at: '2025-12-20T12:00:00-03:00' },
      ],
      (x) => x.at,
    )
    expect([...grouped.keys()].sort()).toEqual([2025, 2026])
    expect(grouped.get(2026)?.get(8)?.map((x) => x.id)).toEqual(['a'])
    expect(grouped.get(2026)?.get(1)?.map((x) => x.id)).toEqual(['b'])
    expect(grouped.get(2025)?.get(12)?.map((x) => x.id)).toEqual(['c'])
  })

  it('etiqueta el mes en español', () => {
    expect(monthLabelEs(2026, 8).toLowerCase()).toContain('agosto')
    expect(monthLabelEs(2026, 8)).toContain('2026')
  })
})

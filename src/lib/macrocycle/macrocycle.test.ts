import { describe, expect, it } from 'vitest'
import {
  assignLanes,
  blockColor,
  durationWeeks,
  overlappingIds,
  shiftRoutineDates,
  weekStartDates,
  yearWeeks,
} from '@/lib/macrocycle/macrocycle'

describe('yearWeeks', () => {
  it('cubre el año completo en semanas de lunes a domingo', () => {
    const weeks = yearWeeks(2026)
    expect(weeks[0]!.start).toBe('2025-12-29')
    expect(weeks[0]!.days[3]).toBe('2026-01-01')
    expect(weeks[weeks.length - 1]!.days).toContain('2026-12-31')
    expect(weeks[0]!.month).toBe(0)
    expect(weeks).toHaveLength(53)
  })
})

describe('assignLanes / overlappingIds', () => {
  const blocks = [
    { id: 'a', start: '2026-06-01', end: '2026-06-28' },
    { id: 'b', start: '2026-06-29', end: '2026-07-26' },
    { id: 'c', start: '2026-06-15', end: '2026-08-30' },
  ]
  it('apila solo los bloques que se pisan', () => {
    const lanes = assignLanes(blocks)
    expect(lanes.get('a')).toBe(0)
    expect(lanes.get('b')).toBe(0)
    expect(lanes.get('c')).toBe(1)
    expect([...overlappingIds(blocks)].sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('shiftRoutineDates', () => {
  it('mueve rutina y semanas juntas', () => {
    const r = shiftRoutineDates(
      { id: 'r', start_date: '2026-09-14', end_date: '2026-10-11' },
      [
        { id: 'w1', start_date: '2026-09-14', end_date: '2026-09-20' },
        { id: 'w2', start_date: null, end_date: null },
      ],
      7,
    )
    expect(r.routine).toEqual({ id: 'r', start_date: '2026-09-21', end_date: '2026-10-18' })
    expect(r.weeks[0]).toEqual({ id: 'w1', start_date: '2026-09-21', end_date: '2026-09-27' })
    expect(r.weeks[1]!.start_date).toBeNull()
  })
})

describe('weekStartDates / durationWeeks / blockColor', () => {
  it('completa fechas de semanas sin fecha', () => {
    const m = weekStartDates('2026-09-14', [
      { id: 'w2', sort_order: 2, start_date: null },
      { id: 'w1', sort_order: 1, start_date: null },
    ])
    expect(m.get('w1')).toBe('2026-09-14')
    expect(m.get('w2')).toBe('2026-09-21')
  })

  it('duración en semanas y color por tipo', () => {
    expect(durationWeeks('2026-09-14', '2026-10-11')).toBe(4)
    expect(blockColor('descarga', null)).toBe('#34d399')
    expect(blockColor('descarga', '#112233')).toBe('#112233')
  })
})

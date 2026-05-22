import { describe, expect, it } from 'vitest'
import { cascadeWeekDatesFromBlock, weekEndFromStart } from './weekBlockDates'

describe('weekBlockDates', () => {
  it('weekEndFromStart adds 6 days', () => {
    expect(weekEndFromStart('2024-09-16')).toBe('2024-09-22')
  })

  it('cascadeWeekDatesFromBlock propagates following weeks', () => {
    const blocks = [
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 1 },
      { id: 'c', sort_order: 2 },
    ]
    const patches = cascadeWeekDatesFromBlock(blocks, 'a', '2024-09-16')
    expect(patches).toHaveLength(3)
    expect(patches[0]).toEqual({ id: 'a', start_date: '2024-09-16', end_date: '2024-09-22' })
    expect(patches[1].start_date).toBe('2024-09-23')
    expect(patches[1].end_date).toBe('2024-09-29')
    expect(patches[2].start_date).toBe('2024-09-30')
  })
})

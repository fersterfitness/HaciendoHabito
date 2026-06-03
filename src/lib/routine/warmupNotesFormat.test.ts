import { describe, expect, it } from 'vitest'
import { formatWarmupDisplayLines } from './warmupNotesFormat'

describe('formatWarmupDisplayLines', () => {
  it('splits multiline input', () => {
    expect(formatWarmupDisplayLines('1) A\n2) B')).toEqual(['1) A', '2) B'])
  })

  it('splits numbered items on one line', () => {
    const lines = formatWarmupDisplayLines('2/3 vueltas 1) Mov A 2) Mov B')
    expect(lines.length).toBeGreaterThan(1)
    expect(lines[0]).toContain('vueltas')
  })
})

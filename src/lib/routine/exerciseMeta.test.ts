import { describe, expect, it } from 'vitest'
import { buildPdfSeriesRows, formatEffortAt, pdfExerciseDisplay } from '@/lib/routine/exerciseMeta'

describe('formatEffortAt', () => {
  it('pasa el RPE a notación @', () => {
    expect(formatEffortAt('8')).toBe('@8')
    expect(formatEffortAt('RPE 8')).toBe('@8')
    expect(formatEffortAt('rpe7-8')).toBe('@7-8')
    expect(formatEffortAt(9)).toBe('@9')
  })

  it('deja RIR y texto libre como están', () => {
    expect(formatEffortAt('RIR 2')).toBe('RIR 2')
    expect(formatEffortAt('@8')).toBe('@8')
    expect(formatEffortAt('fallo')).toBe('fallo')
    expect(formatEffortAt('  ')).toBeNull()
  })
})

describe('buildPdfSeriesRows', () => {
  const plan = [
    { pct: '82', kg: '110', reps: '4-6', rpeRir: '8' },
    { pct: '82', kg: '110', reps: '4-6', rpeRir: 'RPE 9' },
  ]

  it('numera cada serie y recalcula el kg con el 1RM vigente', () => {
    expect(buildPdfSeriesRows(plan, 145)).toEqual([
      { n: 1, kg: '118,9 kg', pct: '82%', reps: '4-6', effort: '@8' },
      { n: 2, kg: '118,9 kg', pct: '82%', reps: '4-6', effort: '@9' },
    ])
  })

  it('sin 1RM usa el kg guardado', () => {
    expect(buildPdfSeriesRows(plan, undefined)?.[0].kg).toBe('110 kg')
  })
})

describe('pdfExerciseDisplay', () => {
  it('muestra el RPE con @', () => {
    const row = pdfExerciseDisplay({ weight_kg: 50, technical_notes: null, rpe: 8 })
    expect(row.rpeDisplay).toBe('@8')
  })
})

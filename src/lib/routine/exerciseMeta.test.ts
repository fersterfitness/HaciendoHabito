import { describe, expect, it } from 'vitest'
import { barKgOf, buildExerciseTechnicalNotes, buildPdfSeriesRows, formatEffortAt, parseExerciseMeta, pdfExerciseDisplay, perSideKg, plannedWeightText, totalFromSideKg, weightModeOf } from '@/lib/routine/exerciseMeta'

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

describe('peso total o por lado (feedback nov19, tanda 3)', () => {
  it('100 kg total con barra de 20 son 40 por lado, y vuelve', () => {
    expect(perSideKg(100, 20)).toBe(40)
    expect(totalFromSideKg(40, 20)).toBe(100)
    expect(perSideKg(15, 20)).toBe(0)
    expect(perSideKg(30, 0)).toBe(15)
  })

  it('el alumno ve el peso según lo que marcó el entrenador', () => {
    expect(plannedWeightText(100, {})).toBe('100 kg')
    expect(plannedWeightText(100, { weightMode: 'lado' })).toBe('40 kg por lado')
    expect(plannedWeightText(100, { weightMode: 'ambos' })).toBe('100 kg · 40 por lado')
    expect(plannedWeightText(62.5, { weightMode: 'lado', barKg: 0 })).toBe('31,3 kg por lado')
  })

  it('el modo queda guardado en las notas técnicas y «total» no deja rastro', () => {
    const notes = buildExerciseTechnicalNotes('Bajar lento', { weightMode: 'lado', barKg: 15 })
    const { meta, userNotes } = parseExerciseMeta(notes)
    expect(userNotes).toBe('Bajar lento')
    expect(weightModeOf(meta)).toBe('lado')
    expect(barKgOf(meta)).toBe(15)
    expect(buildExerciseTechnicalNotes('Bajar lento', { weightMode: 'total' })).toBe('Bajar lento')
    expect(barKgOf({})).toBe(20)
  })
})

import { describe, expect, it } from 'vitest'
import { clockLabel, previousLabel, previousSetsByExercise } from './previousSets'

const mark = (kg: number | null, reps: number | null) => ({ kg, reps, completed: true })

describe('previousSetsByExercise', () => {
  const blocks = [
    { days: [{ exercises: [{ id: 'a1', name: 'Hip thrust' }, { id: 'b1', name: 'Remo' }] }] },
    { days: [{ exercises: [{ id: 'a2', name: 'hip  THRUST' }, { id: 'b2', name: 'Remo' }] }] },
    { days: [{ exercises: [{ id: 'a3', name: 'Hip thrust' }] }] },
  ]

  it('toma lo último anotado del mismo ejercicio en un día anterior', () => {
    const prev = previousSetsByExercise(blocks, { a1: { 1: mark(60, 8) }, a2: { 1: mark(65, 8) } })
    expect(prev.a2?.[1]?.kg).toBe(60)
    expect(prev.a3?.[1]?.kg).toBe(65)
    expect(prev.a1).toBeUndefined()
  })

  it('saltea las veces sin kilos ni reps', () => {
    const prev = previousSetsByExercise(blocks, { b1: { 1: { kg: null, reps: null, completed: true } } })
    expect(prev.b2).toBeUndefined()
  })
})

describe('etiquetas', () => {
  it('arma «kg × reps» y el reloj', () => {
    expect(previousLabel(mark(62.5, 8))).toBe('62,5 kg × 8')
    expect(previousLabel(mark(null, 10))).toBe('× 10')
    expect(previousLabel(undefined)).toBe('')
    expect(clockLabel(90)).toBe('1:30')
    expect(clockLabel(5)).toBe('0:05')
  })
})

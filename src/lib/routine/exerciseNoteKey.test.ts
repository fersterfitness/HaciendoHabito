import { describe, expect, it } from 'vitest'
import { exerciseNoteKey } from './studentTrainingLog'

describe('clave de la nota propia del alumno', () => {
  it('es la misma para el mismo ejercicio escrito distinto', () => {
    expect(exerciseNoteKey('  Press   Banca ')).toBe('press banca')
    expect(exerciseNoteKey('PRESS BANCA')).toBe(exerciseNoteKey('press banca'))
  })
  it('sin nombre queda vacía', () => {
    expect(exerciseNoteKey(null)).toBe('')
  })
})

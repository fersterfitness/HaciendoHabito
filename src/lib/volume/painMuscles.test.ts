import { describe, expect, it } from 'vitest'
import { painMuscles } from './painMuscles'

describe('painMuscles', () => {
  it('reconoce la zona escrita por el alumno, con o sin tildes', () => {
    expect(painMuscles('Me molesta el hombro derecho')).toEqual(['deltoides'])
    expect(painMuscles('dolor LUMBAR al despertar')).toEqual(['espalda'])
    expect(painMuscles('Rodilla izquierda en la sentadilla')).toEqual(['cuadriceps'])
    expect(painMuscles('tirón en el glúteo')).toEqual(['gluteo'])
    expect(painMuscles('Trícep y codo')).toEqual(['triceps'])
  })

  it('distingue lo posterior', () => {
    expect(painMuscles('hombro posterior')).toEqual(['deltoide_post'])
    expect(painMuscles('posterior del muslo')).toEqual(['femoral'])
  })

  it('puede devolver varias zonas o ninguna', () => {
    expect(painMuscles('cuello y espalda alta')).toEqual(['trapecio', 'espalda'])
    expect(painMuscles('me sentí cansado')).toEqual([])
    expect(painMuscles('')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_QUESTIONS,
  answerErrors,
  buildAnswers,
  cleanQuestions,
  normalizeQuestions,
  payDayLabel,
  questionProblems,
  type FormQuestion,
} from './marketplaceForm'

const q = (p: Partial<FormQuestion>): FormQuestion => ({ id: 'a', texto: 'Edad', tipo: 'corta', opciones: [], obligatoria: false, ...p })

describe('formulario propio del profesional (feedback nov19, tanda 6)', () => {
  it('sin preguntas guardadas usa las de base y limpia lo que viene de la base', () => {
    expect(normalizeQuestions(null)).toBe(DEFAULT_QUESTIONS)
    expect(
      normalizeQuestions([
        { id: 'x', texto: '  Peso  ', tipo: 'corta', obligatoria: true },
        { id: 'y', texto: '', tipo: 'corta' },
        { id: 'z', texto: 'Turno', tipo: 'opciones', opciones: ['Mañana'] },
        { id: 'w', texto: 'Algo', tipo: 'raro' },
      ]),
    ).toEqual([
      { id: 'x', texto: 'Peso', tipo: 'corta', opciones: [], obligatoria: true },
      { id: 'z', texto: 'Turno', tipo: 'corta', opciones: [], obligatoria: false },
      { id: 'w', texto: 'Algo', tipo: 'corta', opciones: [], obligatoria: false },
    ])
  })

  it('no deja guardar preguntas vacías ni opciones de a una', () => {
    expect(questionProblems([q({ texto: ' ' })])).toEqual(['La pregunta 1 está vacía.'])
    expect(questionProblems([q({ tipo: 'opciones', opciones: ['Sí', ' '] })])).toEqual(['La pregunta 1 necesita al menos 2 opciones.'])
    expect(cleanQuestions([q({ texto: ' Turno ', tipo: 'opciones', opciones: [' Mañana', '', 'Tarde '] })])[0]).toMatchObject({ texto: 'Turno', opciones: ['Mañana', 'Tarde'] })
  })

  it('exige las obligatorias y siempre el día de pago', () => {
    const qs = [q({ id: 'edad', obligatoria: true }), q({ id: 'extra', texto: 'Comentarios' })]
    expect(answerErrors(qs, {}, '')).toEqual({ edad: 'Completá esta pregunta.', pago: 'Elegí qué día del mes vas a pagar.' })
    expect(answerErrors(qs, { edad: '30' }, 'ultimo')).toEqual({})
    expect(answerErrors(qs, { edad: '30' }, '31')).toHaveProperty('pago')
    expect(buildAnswers(qs, { edad: ' 30 ' })).toEqual([
      { pregunta: 'Edad', respuesta: '30' },
      { pregunta: 'Comentarios', respuesta: '' },
    ])
    expect(payDayLabel('10')).toBe('el día 10 de cada mes')
    expect(payDayLabel('ultimo')).toBe('el último día del mes')
  })
})

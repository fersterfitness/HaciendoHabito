import { describe, expect, it } from 'vitest'
import {
  requestToStudentPrefill,
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

describe('requestToStudentPrefill', () => {
  const base = {
    cliente_nombre: ' Ana Pérez ',
    cliente_email: 'ana@mail.com',
    cliente_whatsapp: '11 2345 6789',
    plan_titulo: 'Plan mensual',
    plan_precio: 50000,
    plan_duracion: 'mensual',
    deporte: 'Running',
    objetivo: 'Bajar tiempos',
  }

  it('pasa datos, respuestas, día de pago y cuota mensual', () => {
    const p = requestToStudentPrefill({
      ...base,
      form_dia_pago: 'ultimo',
      form_respuestas: [
        { pregunta: 'Edad', respuesta: '30' },
        { pregunta: 'Lesiones', respuesta: '' },
      ],
    })
    expect(p.full_name).toBe('Ana Pérez')
    expect(p.payment_day).toBe(31)
    expect(p.monthly_fee).toBe(50000)
    expect(p.notes).toContain('Plan mensual')
    expect(p.notes).toContain('- Edad: 30')
    expect(p.notes).not.toContain('Lesiones')
  })

  it('sin formulario ni plan mensual no inventa día ni cuota', () => {
    const p = requestToStudentPrefill({ ...base, plan_duracion: 'sesion' })
    expect(p.payment_day).toBeNull()
    expect(p.monthly_fee).toBeNull()
    expect(p.notes).not.toContain('Formulario:')
  })
})

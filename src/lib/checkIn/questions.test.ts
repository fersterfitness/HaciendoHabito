import { describe, expect, it } from 'vitest'
import {
  CHECK_IN_SKIP_OPTION,
  encodeChoiceAnswer,
  formatStoredAnswer,
  isQuestionVisible,
  menstrualDateFromAnswers,
  parseQuestions,
  parseStoredChoice,
  serializeDrafts,
  validateDrafts,
  weekStatusFromAnswers,
  checkInHistoryMeta,
  type CheckInAnswerDraft,
  type CheckInQuestion,
} from '@/lib/checkIn/questions'

const choiceQ: CheckInQuestion = {
  id: 'q1',
  key: 'week_status',
  label: 'Semana',
  type: 'choice',
  allowNote: true,
  options: [
    { id: 'finished', label: 'Terminé', color: '#22c55e' },
    { id: 'in_week', label: 'Estoy en mi semana', color: '#f59e0b', extra: 'number' },
  ],
}

const cycleQ: CheckInQuestion = {
  id: 'q2',
  key: 'cycle',
  label: 'Ciclo',
  type: 'choice',
  visibleIfGender: 'F',
  options: [{ id: 'last_date', label: 'Última menstruación', color: '#a855f7', extra: 'date' }],
}

describe('parseQuestions', () => {
  it('acepta choice con opciones y visibleIfGender', () => {
    const qs = parseQuestions([
      {
        id: '1',
        label: 'Ciclo',
        type: 'choice',
        key: 'cycle',
        visibleIfGender: 'F',
        options: [{ id: 'a', label: 'Sí', color: '#f43f5e' }],
      },
    ])
    expect(qs).toHaveLength(1)
    expect(qs[0]?.type).toBe('choice')
    expect(qs[0]?.visibleIfGender).toBe('F')
    expect(qs[0]?.options?.[0]?.id).toBe('a')
    expect(qs[0]?.allowNote).toBe(true)
  })

  it('mantiene text y scale legacy', () => {
    const qs = parseQuestions([
      { id: 'a', label: 'Texto', type: 'text' },
      { id: 'b', label: 'Escala', type: 'scale' },
    ])
    expect(qs.map((q) => q.type)).toEqual(['text', 'scale'])
  })
})

describe('choice encode/decode', () => {
  it('roundtrip con extra y nota', () => {
    const encoded = encodeChoiceAnswer({ option: 'in_week', extra: '3', note: 'voy bien' })
    expect(parseStoredChoice(encoded)).toEqual({ option: 'in_week', extra: '3', note: 'voy bien' })
  })

  it('acepta objeto crudo (por si el RPC guarda jsonb)', () => {
    expect(parseStoredChoice({ option: 'a', note: 'hola' })).toEqual({ option: 'a', extra: undefined, note: 'hola' })
  })
})

describe('weekStatusFromAnswers', () => {
  it('detecta mes terminado', () => {
    const answers = { q1: encodeChoiceAnswer({ option: 'finished' }) }
    expect(weekStatusFromAnswers([choiceQ], answers)).toEqual({ finished: true, weekNumber: null })
  })

  it('lee número de semana', () => {
    const answers = { q1: encodeChoiceAnswer({ option: 'in_week', extra: '4' }) }
    expect(weekStatusFromAnswers([choiceQ], answers)).toEqual({ finished: false, weekNumber: 4 })
  })
})

describe('menstrualDateFromAnswers', () => {
  it('extrae fecha ISO', () => {
    const answers = { q2: encodeChoiceAnswer({ option: 'last_date', extra: '2026-08-01' }) }
    expect(menstrualDateFromAnswers([cycleQ], answers)).toBe('2026-08-01')
  })
})

describe('isQuestionVisible', () => {
  it('oculta ciclo si el alumno no es F', () => {
    expect(isQuestionVisible(cycleQ, 'M')).toBe(false)
    expect(isQuestionVisible(cycleQ, 'F')).toBe(true)
    expect(isQuestionVisible(cycleQ, null)).toBe(true)
  })
})

describe('serializeDrafts / validateDrafts', () => {
  it('envía skip en preguntas ocultas para no romper el RPC', () => {
    const drafts: Record<string, CheckInAnswerDraft> = {
      q2: { optionId: '', extra: '', note: '', text: '' },
    }
    const payload = serializeDrafts([cycleQ], drafts, 'M')
    expect(parseStoredChoice(payload.q2)?.option).toBe(CHECK_IN_SKIP_OPTION)
    expect(validateDrafts([cycleQ], drafts, 'M')).toBeNull()
  })

  it('exige número de semana en in_week', () => {
    const drafts: Record<string, CheckInAnswerDraft> = {
      q1: { optionId: 'in_week', extra: '', note: '', text: '' },
    }
    expect(validateDrafts([choiceQ], drafts, null)).toMatch(/número de semana/i)
  })
})

describe('formatStoredAnswer', () => {
  it('muestra etiqueta + aclaración', () => {
    const raw = encodeChoiceAnswer({ option: 'finished', note: 'listo' })
    expect(formatStoredAnswer(choiceQ, raw)).toContain('Terminé')
    expect(formatStoredAnswer(choiceQ, raw)).toContain('listo')
  })
})

describe('checkInHistoryMeta', () => {
  it('arma mes, fecha, nombre y semana o mes terminado', () => {
    const answers = { q1: encodeChoiceAnswer({ option: 'finished' }) }
    const meta = checkInHistoryMeta([choiceQ], answers, '2026-08-25T15:00:00-03:00', 'Ana Pérez')
    expect(meta.weekLabel).toBe('Terminé mi mes de rutina')
    expect(meta.filingLabel).toContain('Ana Pérez')
    expect(meta.filingLabel).toContain('Terminé mi mes de rutina')
  })
})

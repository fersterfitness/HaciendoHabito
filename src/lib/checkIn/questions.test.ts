import { describe, expect, it } from 'vitest'
import {
  CHECK_IN_SKIP_OPTION,
  encodeChoiceAnswer,
  formatStoredAnswer,
  isQuestionVisible,
  menstrualDateFromAnswers,
  mergeCheckInTemplate,
  parseQuestions,
  parseStoredChoice,
  remapResponsesToQuestionIds,
  serializeDrafts,
  syncWeeklyQuestionCatalog,
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
    { id: 'last_week', label: 'Estoy en mi última semana', color: '#f43f5e' },
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
    expect(weekStatusFromAnswers([choiceQ], answers)).toEqual({
      finished: true,
      weekNumber: null,
      lastWeek: false,
    })
  })

  it('lee número de semana', () => {
    const answers = { q1: encodeChoiceAnswer({ option: 'in_week', extra: '4' }) }
    expect(weekStatusFromAnswers([choiceQ], answers)).toEqual({
      finished: false,
      weekNumber: 4,
      lastWeek: false,
    })
  })

  it('detecta última semana aunque el id de pregunta haya cambiado', () => {
    const answers = { old_q: encodeChoiceAnswer({ option: 'last_week' }) }
    expect(weekStatusFromAnswers([choiceQ], answers)).toEqual({
      finished: false,
      weekNumber: null,
      lastWeek: true,
    })
  })

  it('lee la semana aunque la respuesta esté bajo un id viejo', () => {
    const answers = { old_week: encodeChoiceAnswer({ option: 'in_week', extra: '3' }) }
    expect(weekStatusFromAnswers([choiceQ], answers)).toEqual({
      finished: false,
      weekNumber: 3,
      lastWeek: false,
    })
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

  it('etiqueta última semana', () => {
    const answers = { q1: encodeChoiceAnswer({ option: 'last_week' }) }
    expect(checkInHistoryMeta([choiceQ], answers, '2026-08-25T15:00:00-03:00').weekLabel).toBe('Última semana')
  })
})

describe('mergeCheckInTemplate / remapResponsesToQuestionIds', () => {
  it('conserva el id de la pregunta week_status', () => {
    const current: CheckInQuestion[] = [
      { ...choiceQ, id: 'stable-week-id', label: 'Semana vieja' },
    ]
    const merged = mergeCheckInTemplate(current, [
      { ...choiceQ, id: 'new-uuid', label: '¿En qué semana de entrenamiento estás?' },
    ])
    expect(merged[0]?.id).toBe('stable-week-id')
    expect(merged[0]?.options?.some((o) => o.id === 'last_week')).toBe(true)
  })

  it('copia respuestas al id nuevo si la key coincide', () => {
    const oldQs: CheckInQuestion[] = [{ ...choiceQ, id: 'old-id' }]
    const newQs: CheckInQuestion[] = [{ ...choiceQ, id: 'new-id' }]
    const encoded = encodeChoiceAnswer({ option: 'in_week', extra: '2' })
    const next = remapResponsesToQuestionIds({ 'old-id': encoded }, oldQs, newQs)
    expect(next['new-id']).toBe(encoded)
    expect(next['old-id']).toBe(encoded)
  })

  it('agrega last_week y actualiza el ánimo sin cambiar ids', () => {
    const current: CheckInQuestion[] = [
      {
        id: 'keep-week',
        key: 'week_status',
        label: '¿En qué semana de entrenamiento estás?',
        type: 'choice',
        options: [
          { id: 'finished', label: 'Terminé mi mes de rutina', color: '#22c55e' },
          { id: 'in_week', label: 'Estoy en mi semana', color: '#f59e0b', extra: 'number' },
        ],
      },
      {
        id: 'keep-mood',
        key: 'mood',
        label: '¿Cuál de estas opciones representa mejor tu semana?',
        type: 'choice',
        options: [
          { id: 'a', label: 'Me siento contento/a', color: '#22c55e' },
          { id: 'b', label: 'Estoy triste', color: '#f43f5e' },
          { id: 'c', label: 'Estoy cansado/a', color: '#f59e0b' },
        ],
      },
    ]
    const { questions, changed } = syncWeeklyQuestionCatalog(current)
    expect(changed).toBe(true)
    expect(questions.find((q) => q.key === 'week_status')?.id).toBe('keep-week')
    expect(questions.find((q) => q.key === 'week_status')?.options?.map((o) => o.id)).toContain('last_week')
    expect(questions.find((q) => q.key === 'mood')?.id).toBe('keep-mood')
    expect(questions.find((q) => q.key === 'mood')?.options?.find((o) => o.id === 'b')?.label).toBe(
      'Estoy con temas personales',
    )
  })
})

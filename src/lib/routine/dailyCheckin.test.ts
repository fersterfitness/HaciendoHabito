import { describe, expect, it } from 'vitest'
import { EMPTY_DAY_LOG } from './studentTrainingLog'
import { EMPTY_DRAFT, dailySummary, draftToLog, missingAnswers, painMessage, type DailyCheckinDraft } from './dailyCheckin'

const full: DailyCheckinDraft = {
  ...EMPTY_DRAFT,
  scales: { energy: 4, sleep: 3, stress: 2, soreness: 1, hydration: 4, motivation: 5, recovery: 4, nutrition: 4 },
  sleepHours: '6to7',
  painKind: 'none',
}

describe('chequeo diario', () => {
  it('pide todas las escalas, las horas de sueño y el tipo de dolor', () => {
    expect(missingAnswers(EMPTY_DRAFT, { weekClose: false, woman: false })).toContain('Energía')
    expect(missingAnswers(full, { weekClose: false, woman: false })).toEqual([])
  })

  it('con dolor no habitual hay que marcar dónde', () => {
    const d = { ...full, painKind: 'unusual' as const }
    expect(missingAnswers(d, { weekClose: false, woman: false })).toEqual(['Dónde te duele'])
    expect(missingAnswers({ ...d, painAreas: ['gluteo'] }, { weekClose: false, woman: false })).toEqual([])
  })

  it('con alimentación 1 o 2 pide qué la complicó, y el texto si es «Otro»', () => {
    const d = { ...full, scales: { ...full.scales, nutrition: 2 } }
    expect(missingAnswers(d, { weekClose: false, woman: false })).toEqual(['Qué te complicó la alimentación'])
    expect(missingAnswers({ ...d, nutritionIssue: 'other' }, { weekClose: false, woman: false })).toEqual(['Contanos qué te complicó'])
    expect(missingAnswers({ ...d, nutritionIssue: 'time' }, { weekClose: false, woman: false })).toEqual([])
  })

  it('al cerrar la semana pide pasos, y el ciclo solo a mujeres', () => {
    expect(missingAnswers(full, { weekClose: true, woman: false })).toEqual(['Pasos'])
    expect(missingAnswers({ ...full, steps: 'lt5000' }, { weekClose: true, woman: true })).toEqual(['Ciclo menstrual'])
    expect(missingAnswers({ ...full, steps: 'lt5000', cycle: 'not_logged' }, { weekClose: true, woman: true })).toEqual(['Fecha del ciclo'])
  })

  it('no guarda lo que no corresponde', () => {
    const log = draftToLog({ ...full, painAreas: ['gluteo'], painNote: 'x', nutritionIssue: 'time', steps: 'gt12000' }, { weekClose: false, woman: false })
    expect(log.pain_areas).toEqual([])
    expect(log.pain_note).toBe('')
    expect(log.nutrition_issue).toBeNull()
    expect(log.steps_avg).toBeNull()
  })

  it('arma el aviso y el resumen con los músculos en palabras', () => {
    expect(painMessage(['gluteo', 'femoral'], ' me tira ')).toBe('Dolor no habitual en Glúteo, Femoral · me tira')
    const s = dailySummary({ ...EMPTY_DAY_LOG, energy: 4, sleep: 3, sleep_hours: '6to7', pain_kind: 'unusual', pain_areas: ['gluteo'], pain_note: 'al subir' }, { full: true })
    expect(s).toBe('Energía 4/5 · Sueño 3/5 (6 a 7 h) · Dolor no habitual: Glúteo («al subir»)')
  })
})

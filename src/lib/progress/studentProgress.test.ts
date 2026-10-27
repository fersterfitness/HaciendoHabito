import { describe, expect, it } from 'vitest'
import {
  addMissingWellbeingQuestions,
  createWeeklyCheckInQuestions,
  encodeChoiceAnswer,
} from '@/lib/checkIn/questions'
import {
  buildLiftProgress,
  buildProgressWeeks,
  mondayOfYmd,
  recentVsPrevious,
  weekAdherence,
  type ProgressWeek,
} from '@/lib/progress/studentProgress'
import type { StudentRmRecord } from '@/types/database'

const questions = createWeeklyCheckInQuestions()
const byKey = (k: string) => questions.find((q) => q.key === k)!

function point(submittedAt: string, answers: Record<string, string | number>) {
  const responses: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(answers)) {
    responses[byKey(k).id] = typeof v === 'string' ? encodeChoiceAnswer({ option: v }) : v
  }
  return { submittedAt, questions, responses }
}

describe('buildProgressWeeks', () => {
  it('toma el último check-in de cada semana y calcula adherencia, bienestar y pasos', () => {
    const weeks = buildProgressWeeks(
      [
        point('2026-10-09T15:00:00Z', { training: 'b', meals: 'a', sleep: 2, energy: 3, stress: 4, hunger: 2, steps: 'lt5k' }),
        point('2026-10-10T15:00:00Z', { training: 'a', meals: 'a', sleep: 4, energy: 4, stress: 2, hunger: 3, steps: '7k_10k' }),
        point('2026-10-16T15:00:00Z', { training: 'c', meals: 'b' }),
      ],
      ['2026-10-05', '2026-10-06', '2026-10-06', '2026-10-07'],
      new Date(2026, 9, 27),
    )
    expect(weeks.map((w) => w.weekKey)).toEqual(['2026-10-05', '2026-10-12'])
    expect(weeks[0]).toMatchObject({ training: 100, meals: 100, sleep: 4, stress: 2, steps: 8750, habitsPct: 43 })
    expect(weeks[1]).toMatchObject({ training: 0, meals: 50, sleep: null, steps: null, habitsPct: null })
    expect(weekAdherence(weeks[0]!)).toBe(81)
  })
})

describe('semana en curso', () => {
  it('calcula el % de hábitos sobre los días ya transcurridos', () => {
    const weeks = buildProgressWeeks([], ['2026-10-26', '2026-10-27'], new Date(2026, 9, 27))
    expect(weeks[0]).toMatchObject({ weekKey: '2026-10-26', habitsPct: 100 })
  })
})

describe('recentVsPrevious', () => {
  it('compara las últimas semanas con las anteriores', () => {
    const weeks = [10, 20, 30, 40].map((v) => ({ sleep: v }) as ProgressWeek)
    expect(recentVsPrevious(weeks, (w) => w.sleep, 2)).toEqual({ current: 35, previous: 15, delta: 20 })
  })

  it('sin semanas anteriores no hay delta', () => {
    const weeks = [10, 20].map((v) => ({ sleep: v }) as ProgressWeek)
    expect(recentVsPrevious(weeks, (w) => w.sleep, 4)).toEqual({ current: 15, previous: null, delta: null })
  })
})

describe('mondayOfYmd', () => {
  it('lleva domingo al lunes anterior', () => {
    expect(mondayOfYmd('2026-10-11')).toBe('2026-10-05')
    expect(mondayOfYmd('2026-10-05')).toBe('2026-10-05')
  })
})

describe('buildLiftProgress', () => {
  it('agrupa por nombre y mide la mejora del primer al último test', () => {
    const rec = (id: string, name: string, kg: number, date: string) =>
      ({ id, exercise_id: id, rm_kg: kg, tested_at: date, created_at: date, exercise: { id, name } }) as StudentRmRecord
    const lifts = buildLiftProgress([
      rec('a', 'Press banca', 135, '2026-06-02'),
      rec('b', 'Press Banca', 145, '2026-09-25'),
      rec('c', 'Dominadas', 30, '2026-09-25'),
    ])
    expect(lifts[0]).toMatchObject({ name: 'Press banca', deltaKg: 10, deltaPct: 7.4 })
    expect(lifts[0]!.history).toHaveLength(2)
  })
})

describe('addMissingWellbeingQuestions', () => {
  it('agrega bienestar y pasos a un formulario viejo, una sola vez', () => {
    const old = questions.filter((q) => !['sleep', 'energy', 'stress', 'hunger', 'steps'].includes(q.key ?? ''))
    const next = addMissingWellbeingQuestions(old)
    expect(next.map((q) => q.key).slice(-5)).toEqual(['sleep', 'energy', 'stress', 'hunger', 'steps'])
    expect(addMissingWellbeingQuestions(next)).toBe(next)
  })
})

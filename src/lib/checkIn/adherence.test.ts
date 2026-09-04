import { describe, expect, it } from 'vitest'
import type { CheckInQuestion } from '@/lib/checkIn/questions'
import { buildAdherenceTimeline, latestAdherenceSummary, weeklyAdherenceScore } from '@/lib/checkIn/adherence'

const qs: CheckInQuestion[] = [
  {
    id: 't',
    key: 'training',
    label: 'Entreno',
    type: 'choice',
    options: [
      { id: 'a', label: 'Cumplí todos', color: '#22c55e' },
      { id: 'b', label: 'A medias', color: '#f59e0b' },
      { id: 'c', label: 'Nada', color: '#f43f5e' },
    ],
  },
  {
    id: 'm',
    key: 'meals',
    label: 'Comidas',
    type: 'choice',
    options: [
      { id: 'a', label: '4 comidas', color: '#22c55e' },
      { id: 'b', label: 'No 100%', color: '#f59e0b' },
      { id: 'c', label: 'Gustito', color: '#a855f7' },
    ],
  },
]

describe('weeklyAdherenceScore', () => {
  it('promedia entrenamiento 100 y comidas 50', () => {
    expect(weeklyAdherenceScore(qs, { t: JSON.stringify({ option: 'a' }), m: JSON.stringify({ option: 'b' }) })).toBe(75)
  })
})

describe('buildAdherenceTimeline', () => {
  it('calcula el delta entre semanas', () => {
    const points = buildAdherenceTimeline([
      {
        submittedAt: '2026-08-28T12:00:00-03:00',
        questions: qs,
        responses: { t: JSON.stringify({ option: 'b' }), m: JSON.stringify({ option: 'b' }) },
      },
      {
        submittedAt: '2026-09-04T12:00:00-03:00',
        questions: qs,
        responses: { t: JSON.stringify({ option: 'a' }), m: JSON.stringify({ option: 'a' }) },
      },
    ])
    expect(points).toHaveLength(2)
    expect(points[0]?.score).toBe(50)
    expect(points[1]?.score).toBe(100)
    expect(points[1]?.delta).toBe(50)
    expect(latestAdherenceSummary(points)).toEqual({ score: 100, delta: 50 })
  })
})

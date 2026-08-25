import { describe, expect, it } from 'vitest'
import { encodeChoiceAnswer, type CheckInQuestion } from '@/lib/checkIn/questions'
import { buildCheckInHabitCharts, filterPointsByCompare } from '@/lib/checkIn/habitCharts'

const mood: CheckInQuestion = {
  id: 'm',
  key: 'mood',
  label: 'Ánimo',
  type: 'choice',
  options: [
    { id: 'a', label: 'Contento', color: '#22c55e' },
    { id: 'b', label: 'Triste', color: '#f43f5e' },
  ],
}

describe('buildCheckInHabitCharts', () => {
  it('agrupa por color/opción sin incluir aclaraciones', () => {
    const charts = buildCheckInHabitCharts(
      [
        {
          submittedAt: '2026-08-03T12:00:00-03:00',
          questions: [mood],
          responses: { m: encodeChoiceAnswer({ option: 'a', note: 'secreto' }) },
        },
        {
          submittedAt: '2026-08-10T12:00:00-03:00',
          questions: [mood],
          responses: { m: encodeChoiceAnswer({ option: 'b' }) },
        },
      ],
      'weekly',
    )
    expect(charts).toHaveLength(1)
    expect(charts[0]?.title).toBe('Ánimo')
    expect(charts[0]?.buckets).toHaveLength(2)
    const first = charts[0]?.buckets[0]
    expect(first?.segments.find((s) => s.optionId === 'a')?.count).toBe(1)
    expect(JSON.stringify(charts)).not.toContain('secreto')
  })

  it('filtra un mes para comparar períodos', () => {
    const moodLocal: CheckInQuestion = {
      id: 'm',
      key: 'mood',
      label: 'Ánimo',
      type: 'choice',
      options: [
        { id: 'a', label: 'Contento', color: '#22c55e' },
        { id: 'b', label: 'Triste', color: '#f43f5e' },
      ],
    }
    const points = [
      {
        submittedAt: '2026-07-06T12:00:00-03:00',
        questions: [moodLocal],
        responses: { m: encodeChoiceAnswer({ option: 'a' }) },
      },
      {
        submittedAt: '2026-08-10T12:00:00-03:00',
        questions: [moodLocal],
        responses: { m: encodeChoiceAnswer({ option: 'b' }) },
      },
    ]
    const july = filterPointsByCompare(points, { kind: 'month', year: 2026, month: 7 })
    expect(july).toHaveLength(1)
    const charts = buildCheckInHabitCharts(july, 'monthly')
    expect(charts[0]?.buckets[0]?.segments.find((s) => s.optionId === 'a')?.count).toBe(1)
  })
})

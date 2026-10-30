import { describe, expect, it } from 'vitest'
import { extractPainEvents, painInRange } from '@/lib/checkIn/painEvents'
import type { CheckInQuestion } from '@/lib/checkIn/questions'

const pain: CheckInQuestion = {
  id: 'q1',
  key: 'pain',
  label: '¿Dolor?',
  type: 'choice',
  options: [
    { id: 'a', label: 'Sí', color: '#f00', extra: 'date' },
    { id: 'b', label: 'No', color: '#0f0' },
  ],
}

describe('dolores del check-in', () => {
  it('toma la fecha y la zona; sin fecha usa el día del check-in', () => {
    const events = extractPainEvents([
      { submittedAt: '2026-10-10T12:00:00Z', questions: [pain], responses: { q1: JSON.stringify({ option: 'a', extra: '2026-10-07', note: 'rodilla' }) } },
      { submittedAt: '2026-10-17T12:00:00Z', questions: [pain], responses: { q1: JSON.stringify({ option: 'b' }) } },
      { submittedAt: '2026-10-03T12:00:00Z', questions: [pain], responses: { q1: JSON.stringify({ option: 'a', note: 'hombro' }) } },
    ])
    expect(events).toEqual([
      { date: '2026-10-03', approximate: true, note: 'hombro', submittedAt: '2026-10-03T12:00:00Z' },
      { date: '2026-10-07', approximate: false, note: 'rodilla', submittedAt: '2026-10-10T12:00:00Z' },
    ])
    expect(painInRange(events, '2026-10-05', '2026-10-11').map((e) => e.note)).toEqual(['rodilla'])
    expect(painInRange(events, null, '2026-10-11')).toEqual([])
  })
})

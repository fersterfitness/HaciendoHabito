import { describe, expect, it } from 'vitest'
import { weekStatusFromNotices } from './routineWeekProgress'

describe('semana del alumno según sus avisos', () => {
  it('manda el aviso más nuevo de cada alumno', () => {
    const m = weekStatusFromNotices([
      { studentId: 'a', kind: 'last_week', weekNumber: 4, createdAt: '2026-11-20T10:00:00Z' },
      { studentId: 'a', kind: 'week_done', weekNumber: 3, createdAt: '2026-11-16T10:00:00Z' },
      { studentId: 'b', kind: 'week_done', weekNumber: 1, createdAt: '2026-11-16T10:00:00Z' },
      { studentId: 'c', kind: 'routine_done', weekNumber: 4, createdAt: '2026-11-21T10:00:00Z' },
    ])
    expect(m.get('a')).toMatchObject({ lastWeek: true, finished: false, weekNumber: 4 })
    expect(m.get('b')).toMatchObject({ lastWeek: false, finished: false, weekNumber: 2 })
    expect(m.get('c')).toMatchObject({ finished: true })
  })
})

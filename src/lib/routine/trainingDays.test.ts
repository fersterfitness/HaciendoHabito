import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { trainingDaysFrom } from '@/lib/routine/trainingDays'

describe('trainingDaysFrom (feedback nov19)', () => {
  it('marca cada fecha con lo que hizo: cerró, anotó series o no pudo', () => {
    const map = trainingDaysFrom(
      [
        { status: 'done', status_date: '2026-11-10' },
        { status: 'missed', status_date: '2026-11-12' },
        { status: 'missed', status_date: '2026-11-14' },
        { status: null, status_date: null },
      ],
      [{ updated_at: '2026-11-10T19:00:00' }, { updated_at: '2026-11-13T19:00:00' }, { updated_at: '2026-11-14T19:00:00' }],
    )
    expect(Object.fromEntries(map)).toEqual({
      '2026-11-10': 'done',
      '2026-11-12': 'missed',
      '2026-11-13': 'sets',
      // Marcó un día como no entrenado pero ese mismo día anotó series de otro: entrenó.
      '2026-11-14': 'sets',
    })
  })
})

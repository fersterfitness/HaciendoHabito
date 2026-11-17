import { describe, expect, it } from 'vitest'
import { compareWeekVolume } from './compareVolume'
import { DEFAULT_VOLUME_SETTINGS, MUSCLE_IDS, type WeekVolume } from './trainingVolume'

function week(sets: Partial<Record<(typeof MUSCLE_IDS)[number], number>>): WeekVolume {
  const weighted = Object.fromEntries(MUSCLE_IDS.map((id) => [id, sets[id] ?? 0])) as WeekVolume['weighted']
  return { days: [], raw: weighted, weighted, unmapped: [], totalSets: 0 }
}

describe('compareWeekVolume', () => {
  it('compara músculo por músculo y deja afuera los que no suman en ninguna', () => {
    const [a, b] = MUSCLE_IDS
    const rows = compareWeekVolume(week({ [a]: 6 }), week({ [a]: 9.5, [b]: 4 }), DEFAULT_VOLUME_SETTINGS)
    expect(rows.map((r) => r.id)).toEqual([a, b])
    expect(rows[0]).toMatchObject({ before: 6, now: 9.5, diff: 3.5 })
    expect(rows[1]).toMatchObject({ before: 0, now: 4, diff: 4 })
  })

  it('sin volumen en ninguna semana no hay filas', () => {
    expect(compareWeekVolume(week({}), week({}), DEFAULT_VOLUME_SETTINGS)).toEqual([])
  })
})

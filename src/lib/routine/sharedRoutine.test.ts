import { describe, expect, it } from 'vitest'
import { currentBlockIndex, exerciseDetails, groupExercises, isSetComplete, restText, setsRepsText, type SharedRoutineExercise } from './sharedRoutine'

const ex = (over: Partial<SharedRoutineExercise> = {}): SharedRoutineExercise => ({
  id: 'e',
  name: 'Sentadilla',
  sets: null,
  reps_min: null,
  reps_max: null,
  reps_scheme: null,
  weight_kg: null,
  rir: null,
  rpe: null,
  rest_seconds: null,
  tempo: null,
  percent_rm: null,
  technical_notes: null,
  is_superset: false,
  superset_group: null,
  video_url: null,
  image_url: null,
  ...over,
})

describe('rutina compartida', () => {
  it('counts completion independently of kg and preserves legacy weight logs', () => {
    expect(isSetComplete({ weight_kg: null, completed: true })).toBe(true)
    expect(isSetComplete({ weight_kg: 25, completed: false })).toBe(false)
    expect(isSetComplete({ weight_kg: 25 })).toBe(true)
    expect(isSetComplete({ weight_kg: null, reps: 10 })).toBe(true)
    expect(isSetComplete({ weight_kg: null })).toBe(false)
    expect(isSetComplete(undefined)).toBe(false)
  })
  it('arma series × reps', () => {
    expect(setsRepsText(ex({ sets: 4, reps_min: 8, reps_max: 10 }))).toBe('4 × 8–10')
    expect(setsRepsText(ex({ sets: 3, reps_scheme: '8 / 6 / 5' }))).toBe('3 × 8 / 6 / 5')
    expect(setsRepsText(ex({ sets: 1 }))).toBe('1 serie')
    expect(setsRepsText(ex({ reps_min: 12, reps_max: 12 }))).toBe('12')
  })

  it('formatea el descanso', () => {
    expect(restText(45)).toBe('45 s')
    expect(restText(90)).toBe('1:30 min')
    expect(restText(120)).toBe('2 min')
    expect(restText(0)).toBeNull()
  })

  it('muestra peso, esfuerzo, descanso y notas sin el bloque META', () => {
    const d = exerciseDetails(
      ex({ weight_kg: 62.5, rpe: 8, rest_seconds: 90, tempo: '3-1-1', technical_notes: 'Bajar lento\n[[META]]{"restText":"2 min"}[[/META]]' }),
    )
    expect(d.chips).toEqual(['62,5 kg', 'RPE 8', 'Descanso 1:30 min', 'Tempo 3-1-1'])
    expect(d.notes).toBe('Bajar lento')
    expect(exerciseDetails(ex({ percent_rm: 75, rir: 2 })).chips).toEqual(['75% RM', 'RIR 2'])
  })

  it('elige la semana de hoy', () => {
    const blocks = [
      { start_date: '2026-11-02', end_date: '2026-11-08' },
      { start_date: '2026-11-09', end_date: '2026-11-15' },
      { start_date: '2026-11-16', end_date: '2026-11-22' },
    ]
    expect(currentBlockIndex(blocks, '2026-11-10')).toBe(1)
    expect(currentBlockIndex(blocks, '2026-10-01')).toBe(0)
    expect(currentBlockIndex(blocks, '2026-12-30')).toBe(2)
    expect(currentBlockIndex([{ start_date: null, end_date: null }], '2026-11-10')).toBe(0)
  })

  it('junta los ejercicios del mismo circuito', () => {
    const g = groupExercises([
      ex({ id: 'a' }),
      ex({ id: 'b', is_superset: true, superset_group: 1 }),
      ex({ id: 'c', is_superset: true, superset_group: 1 }),
      ex({ id: 'd', is_superset: true, superset_group: 2 }),
    ])
    expect(g.map((x) => [x.circuit, x.items.map((i) => i.id).join('')])).toEqual([
      [false, 'a'],
      [true, 'bc'],
      [false, 'd'],
    ])
  })
})

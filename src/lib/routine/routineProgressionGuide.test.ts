import { describe, expect, it } from 'vitest'
import { buildRoutineProgressionGuide } from './routineProgressionGuide'

describe('buildRoutineProgressionGuide', () => {
  it('alinea series/reps por semana para el mismo día', () => {
    const blocks = [
      {
        id: 'b1',
        routine_id: 'r1',
        name: 'Semana 1',
        sort_order: 0,
        notes: 'Bloque A',
        start_date: '2026-06-02',
        end_date: '2026-06-08',
        days: [
          {
            id: 'd1',
            block_id: 'b1',
            day_name: 'Día 1',
            day_of_week: null,
            muscle_focus: null,
            warmup_notes: null,
            sort_order: 0,
            exercises: [
              {
                id: 'e1',
                day_id: 'd1',
                exercise_id: 'ex1',
                sort_order: 0,
                sets: 3,
                reps_min: null,
                reps_max: null,
                reps_scheme: '5,4,4',
                weight_kg: null,
                rir: null,
                rpe: null,
                rest_seconds: null,
                tempo: null,
                video_url: null,
                technical_notes: null,
                is_superset: false,
                superset_group: null,
                training_method_id: null,
                method_coach_notes: null,
                exercise: { id: 'ex1', name: 'Dominadas' } as never,
              },
            ],
          },
        ],
      },
      {
        id: 'b2',
        routine_id: 'r1',
        name: 'Semana 2',
        sort_order: 1,
        notes: null,
        start_date: '2026-06-09',
        end_date: '2026-06-15',
        days: [
          {
            id: 'd2',
            block_id: 'b2',
            day_name: 'Día 1',
            day_of_week: null,
            muscle_focus: null,
            warmup_notes: null,
            sort_order: 0,
            exercises: [
              {
                id: 'e2',
                day_id: 'd2',
                exercise_id: 'ex1',
                sort_order: 0,
                sets: 3,
                reps_min: null,
                reps_max: null,
                reps_scheme: '5,5,4',
                weight_kg: null,
                rir: null,
                rpe: null,
                rest_seconds: null,
                tempo: null,
                video_url: null,
                technical_notes: null,
                is_superset: false,
                superset_group: null,
                training_method_id: null,
                method_coach_notes: null,
                exercise: { id: 'ex1', name: 'Dominadas' } as never,
              },
            ],
          },
        ],
      },
    ]

    const guide = buildRoutineProgressionGuide(blocks as never)
    expect(guide).toHaveLength(1)
    expect(guide[0]!.rows[0]!.weeks[0]).toBe('3 × 5,4,4')
    expect(guide[0]!.rows[0]!.weeks[1]).toBe('3 × 5,5,4')
    expect(guide[0]!.blockNotesByWeek[0]).toBe('Bloque A')
  })
})

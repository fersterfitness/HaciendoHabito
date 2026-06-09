import { describe, expect, it } from 'vitest'
import { buildRoutineProgressionGuide, formatGuidePrescriptionCell } from './routineProgressionGuide'

describe('formatGuidePrescriptionCell', () => {
  it('sin series devuelve vacío', () => {
    expect(formatGuidePrescriptionCell({ sets: null, reps_scheme: '12', weight_kg: 10 } as never)).toBe('')
  })

  it('sin peso muestra SIN KG', () => {
    expect(
      formatGuidePrescriptionCell({ sets: 3, reps_scheme: '12', weight_kg: null } as never),
    ).toBe('3x12 / SIN KG')
  })

  it('con peso muestra KG', () => {
    expect(
      formatGuidePrescriptionCell({ sets: 3, reps_scheme: '12', weight_kg: 10 } as never),
    ).toBe('3x12 / 10 KG')
  })
})

describe('buildRoutineProgressionGuide', () => {
  it('alinea el mismo ejercicio individual en una fila por semana', () => {
    const exBase = {
      sort_order: 0,
      reps_min: null,
      reps_max: null,
      rir: null,
      rpe: null,
      rest_seconds: 90,
      tempo: null,
      video_url: null,
      technical_notes: null,
      is_superset: false,
      superset_group: null,
      training_method_id: null,
      method_coach_notes: null,
      exercise: { id: 'ex1', name: 'Dominadas' } as never,
    }

    const blocks = [
      {
        id: 'b1',
        routine_id: 'r1',
        name: 'Semana 1',
        sort_order: 0,
        notes: null,
        start_date: null,
        end_date: null,
        days: [
          {
            id: 'd1',
            block_id: 'b1',
            day_name: 'Día 1',
            day_of_week: null,
            muscle_focus: null,
            warmup_notes: 'No mostrar calentamiento',
            sort_order: 0,
            exercises: [
              {
                ...exBase,
                id: 'e1',
                day_id: 'd1',
                exercise_id: 'ex1',
                sets: 3,
                reps_scheme: '5,4,4',
                weight_kg: null,
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
        start_date: null,
        end_date: null,
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
                ...exBase,
                id: 'e2',
                day_id: 'd2',
                exercise_id: 'ex1',
                sets: 3,
                reps_scheme: '5,5,4',
                weight_kg: 12,
              },
            ],
          },
        ],
      },
    ]

    const guide = buildRoutineProgressionGuide(blocks as never)
    expect(guide).toHaveLength(1)
    const block = guide[0]!.blocks[0]!
    expect(block.kind).toBe('individual')
    expect(block.exercises).toHaveLength(1)
    expect(block.exercises[0]!.weeks[0]).toBe('3x5,4,4 / SIN KG')
    expect(block.exercises[0]!.weeks[1]).toBe('3x5,5,4 / 12 KG')
  })

  it('agrupa circuito en un bloque con aclaración y una fila por ejercicio', () => {
    const circuitMeta = '[[META]]\n{"circuitNote":"1\'30\'\' DE PAUSA ENTRE SERIES"}\n[[/META]]'
    const mk = (id: string, name: string, group: number, order: number, scheme: string) => ({
      id,
      day_id: 'd1',
      exercise_id: id,
      sort_order: order,
      sets: 3,
      reps_min: null,
      reps_max: null,
      reps_scheme: scheme,
      weight_kg: null,
      rir: null,
      rpe: null,
      rest_seconds: null,
      tempo: null,
      video_url: null,
      technical_notes: order === 0 ? circuitMeta : null,
      is_superset: true,
      superset_group: group,
      training_method_id: null,
      method_coach_notes: null,
      exercise: { id, name } as never,
    })

    const blocks = [
      {
        id: 'b1',
        routine_id: 'r1',
        name: 'Semana 1',
        sort_order: 0,
        notes: null,
        start_date: null,
        end_date: null,
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
              mk('e1', 'Sentadilla goblet', 1, 0, '12'),
              mk('e2', 'Pallof', 1, 1, '20'),
            ],
          },
        ],
      },
    ]

    const guide = buildRoutineProgressionGuide(blocks as never)
    const block = guide[0]!.blocks[0]!
    expect(block.kind).toBe('circuit')
    expect(block.headerNotesByWeek[0]).toContain('PAUSA')
    expect(block.exercises).toHaveLength(2)
    expect(block.exercises[0]!.exerciseName).toBe('Sentadilla goblet')
  })

  it('propaga circuitNote a todas las semanas si solo está en una', () => {
    const circuitMeta = '[[META]]\n{"circuitNote":"CIRCUITO DE 3 VUELTAS"}\n[[/META]]'
    const mk = (weekIdx: number, withMeta: boolean) => ({
      id: 'b1',
      routine_id: 'r1',
      name: `Semana ${weekIdx + 1}`,
      sort_order: weekIdx,
      notes: null,
      start_date: null,
      end_date: null,
      days: [
        {
          id: `d${weekIdx}`,
          block_id: 'b1',
          day_name: 'Día 1',
          day_of_week: null,
          muscle_focus: null,
          warmup_notes: null,
          sort_order: 0,
          exercises: [
            {
              id: `e${weekIdx}a`,
              day_id: `d${weekIdx}`,
              exercise_id: 'ex1',
              sort_order: 0,
              sets: 2,
              reps_min: null,
              reps_max: null,
              reps_scheme: '8',
              weight_kg: null,
              rir: null,
              rpe: null,
              rest_seconds: null,
              tempo: null,
              video_url: null,
              technical_notes: withMeta ? circuitMeta : null,
              is_superset: true,
              superset_group: 1,
              training_method_id: null,
              method_coach_notes: null,
              exercise: { id: 'ex1', name: 'Press banca' } as never,
            },
            {
              id: `e${weekIdx}b`,
              day_id: `d${weekIdx}`,
              exercise_id: 'ex2',
              sort_order: 1,
              sets: 2,
              reps_min: null,
              reps_max: null,
              reps_scheme: '10',
              weight_kg: null,
              rir: null,
              rpe: null,
              rest_seconds: null,
              tempo: null,
              video_url: null,
              technical_notes: null,
              is_superset: true,
              superset_group: 1,
              training_method_id: null,
              method_coach_notes: null,
              exercise: { id: 'ex2', name: 'Remo' } as never,
            },
          ],
        },
      ],
    })

    const blocks = [mk(0, true), mk(1, false), mk(2, false), mk(3, false)]
    const guide = buildRoutineProgressionGuide(blocks as never)
    const block = guide[0]!.blocks[0]!
    expect(block.kind).toBe('circuit')
    expect(block.headerNotesByWeek.every((n) => n?.includes('3 VUELTAS'))).toBe(true)
  })
})

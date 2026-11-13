import { describe, expect, it } from 'vitest'
import { prescriptionPatchFrom } from '@/lib/routine/copyDayPrescriptions'
import { buildExerciseTechnicalNotes, parseExerciseMeta } from '@/lib/routine/exerciseMeta'
import type { RoutineExercise } from '@/types/database'

const exercise = (over: Partial<RoutineExercise>): RoutineExercise =>
  ({
    id: 'x',
    sets: 3,
    reps_min: null,
    reps_max: null,
    reps_scheme: null,
    weight_kg: null,
    rir: null,
    rpe: null,
    rest_seconds: null,
    tempo: null,
    video_url: null,
    technical_notes: null,
    is_superset: false,
    superset_group: null,
    ...over,
  }) as RoutineExercise

describe('prescriptionPatchFrom · kilos por porcentaje', () => {
  // Press de banca al 77 % con 1RM de 132,5 kg → 102 kg.
  const bench = exercise({
    weight_kg: 102,
    technical_notes: buildExerciseTechnicalNotes('', {
      percent1rm: '77',
      seriesPlan: [
        { pct: '70', kg: '92.8', reps: '5' },
        { pct: '77', kg: '102', reps: '3' },
      ],
    }),
  })

  it('recalcula los kilos con el 1RM del ejercicio de destino', () => {
    // Peso muerto: 1RM 156 kg → 77 % = 120,1 kg.
    const patch = prescriptionPatchFrom(bench, exercise({}), { targetRmKg: 156 })
    expect(patch.weight_kg).toBe(120.1)
    const { meta } = parseExerciseMeta(patch.technical_notes)
    expect(meta.percent1rm).toBe('77')
    expect(meta.seriesPlan?.map((s) => s.kg)).toEqual(['109.2', '120.1'])
    expect(meta.seriesPlan?.map((s) => s.reps)).toEqual(['5', '3'])
  })

  it('si el destino no tiene 1RM, deja el porcentaje y no arrastra los kilos de otro ejercicio', () => {
    const patch = prescriptionPatchFrom(bench, exercise({}), { targetRmKg: null })
    expect(patch.weight_kg).toBeNull()
    const { meta } = parseExerciseMeta(patch.technical_notes)
    expect(meta.percent1rm).toBe('77')
    expect(meta.seriesPlan?.map((s) => s.kg ?? '')).toEqual(['', ''])
  })

  it('sin porcentaje, los kilos cargados a mano se copian tal cual', () => {
    const src = exercise({ weight_kg: 40 })
    expect(prescriptionPatchFrom(src, exercise({}), { targetRmKg: 156 }).weight_kg).toBe(40)
  })

  it('sin `targetRmKg` se comporta como antes', () => {
    expect(prescriptionPatchFrom(bench, exercise({})).weight_kg).toBe(102)
  })
})

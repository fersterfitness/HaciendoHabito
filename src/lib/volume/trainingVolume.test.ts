import { describe, expect, it } from 'vitest'
import {
  buildSessionVolume,
  computeWeekVolume,
  defaultMuscleFactors,
  detectTechnique,
  DEFAULT_VOLUME_SETTINGS,
  effortTextToRir,
  normalizeVolumeSettings,
  overloadedMuscles,
  volumeStatus,
  type VolumeContext,
  type VolumeExerciseInput,
} from '@/lib/volume/trainingVolume'

function ex(partial: Partial<VolumeExerciseInput> & { name: string; slug?: string }): VolumeExerciseInput {
  return {
    id: partial.id ?? partial.name,
    exercise_id: partial.exercise_id ?? partial.name,
    sets: partial.sets ?? 3,
    reps_scheme: partial.reps_scheme ?? null,
    rir: partial.rir ?? null,
    rpe: partial.rpe ?? null,
    technical_notes: partial.technical_notes ?? null,
    training_method_id: partial.training_method_id ?? null,
    exercise: { name: partial.name, muscle_group: { slug: partial.slug ?? 'multiarticulares' } },
  }
}

const ctx = (over: Partial<VolumeContext> = {}): VolumeContext => ({
  settings: DEFAULT_VOLUME_SETTINGS,
  factorOverrides: new Map(),
  methodNames: new Map(),
  ...over,
})

describe('defaultMuscleFactors', () => {
  it('reconoce multiarticulares por nombre', () => {
    expect(defaultMuscleFactors('Press banca', 'multiarticulares')).toEqual({ pecho: 1, deltoides: 0.5, triceps: 0.5 })
    expect(defaultMuscleFactors('Sentadilla con barra', 'multiarticulares').cuadriceps).toBe(1)
    expect(defaultMuscleFactors('Peso muerto rumano', null).femoral).toBe(1)
    expect(defaultMuscleFactors('Elevaciones laterales', null)).toEqual({ deltoides: 1, trapecio: 0.3 })
  })

  it('si no reconoce el nombre usa la categoría de la biblioteca', () => {
    expect(defaultMuscleFactors('Máquina rara', 'gemelos')).toEqual({ gemelos: 1 })
    expect(defaultMuscleFactors('Salto al cajón', 'pliometricos')).toEqual({})
  })
})

describe('detectTechnique / effortTextToRir', () => {
  it('detecta técnicas por método o notas', () => {
    expect(detectTechnique('Dropset x2')).toBe('dropset')
    expect(detectTechnique(null, '2x12 (2+1 con 5″ pausa)')).toBe('rest_pause')
    expect(detectTechnique('AMRAP', '8-10')).toBe('straight')
  })

  it('convierte RPE/RIR a RIR', () => {
    expect(effortTextToRir('RPE 8')).toBe(2)
    expect(effortTextToRir('@9')).toBe(1)
    expect(effortTextToRir('RIR 1-2')).toBe(1.5)
    expect(effortTextToRir('6o7')).toBe(3.5)
    expect(effortTextToRir('al fallo')).toBe(0)
  })
})

describe('computeWeekVolume', () => {
  it('suma series con sinergias y aplica técnica solo cerca del fallo', () => {
    const week = computeWeekVolume(
      [
        {
          id: 'd1',
          day_name: 'Día 1',
          exercises: [
            ex({ name: 'Press banca', sets: 4, rir: 2 }),
            ex({ name: 'Aperturas', slug: 'pecho', sets: 3, rir: 1, technical_notes: 'último set dropset' }),
            ex({ name: 'Cruce de poleas', slug: 'pecho', sets: 2, rir: 4, technical_notes: 'dropset' }),
          ],
        },
      ],
      ctx(),
    )
    // Press 4×1 + Aperturas 3×1 + Cruce 2×1 = 9 brutas.
    expect(week.raw.pecho).toBe(9)
    // Aperturas con dropset (RIR 1 ≤ 3): 3×1.4; cruce con RIR 4 no aplica dropset.
    expect(week.weighted.pecho).toBe(round(4 + 3 * 1.4 + 2))
    const cruce = week.days[0]!.rows[2]!
    expect(cruce.techniqueBlockedByRir).toBe(true)
    expect(week.weighted.triceps).toBe(2)
  })

  it('una serie lejos del fallo cuenta la mitad y el entrenador puede corregir la implicación', () => {
    const week = computeWeekVolume(
      [{ id: 'd', day_name: 'D', exercises: [ex({ name: 'Press banca', sets: 4, rpe: 4 })] }],
      ctx({ factorOverrides: new Map([['Press banca', { pecho: 1, triceps: 0.3 }]]) }),
    )
    expect(week.raw.pecho).toBe(4)
    expect(week.weighted.pecho).toBe(2)
    expect(week.raw.deltoides).toBe(0)
    expect(week.days[0]!.rows[0]!.customFactors).toBe(true)
  })

  it('la técnica elegida a mano gana sobre la detectada', () => {
    const notes = '[[META]]\n{"volumeTechnique":"burns"}\n[[/META]]\ndropset'
    const week = computeWeekVolume(
      [{ id: 'd', day_name: 'D', exercises: [ex({ name: 'Curl martillo', sets: 2, technical_notes: notes })] }],
      ctx(),
    )
    expect(week.days[0]!.rows[0]!.technique).toBe('burns')
    expect(week.weighted.biceps).toBe(2.5)
  })
})

describe('rangos', () => {
  it('marca músculos por encima del máximo', () => {
    const settings = normalizeVolumeSettings({ targetMin: 10, targetMax: 12, muscleTargets: { pecho: { min: 4, max: 30 } } })
    const week = computeWeekVolume(
      [{ id: 'd', day_name: 'D', exercises: [ex({ name: 'Press banca', sets: 14 }), ex({ name: 'Curl', slug: 'biceps', sets: 14 })] }],
      ctx({ settings }),
    )
    expect(overloadedMuscles(week, settings)).toEqual(['biceps'])
    expect(volumeStatus(0, { min: 10, max: 20 })).toBe('none')
    expect(volumeStatus(8, { min: 10, max: 20 })).toBe('low')
  })
})

function round(n: number) {
  return Math.round(n * 10) / 10
}

describe('buildSessionVolume', () => {
  it('suma las series de toda la sesión por semana (ejemplo Día A: 21 → 16 → 11)', () => {
    const names = ['Estocada', 'Rotaciones landmine', 'Sentadilla', 'Caídas al cajón', 'Sentadilla landmine', 'Saltos laterales', 'Plancha']
    const day = (week: number, sets: number[]) => ({
      id: `a${week}`,
      day_name: 'Día A (piernas) + cadena ant',
      exercises: names.map((name, i) => ex({ id: `${week}-${i}`, name, slug: 'otros', sets: sets[i] })),
    })
    const other = (week: number) => ({ id: `b${week}`, day_name: 'Día B', exercises: [ex({ name: 'Remo', sets: 4 })] })
    const weeks = [
      computeWeekVolume([day(1, [3, 3, 3, 3, 3, 3, 3]), other(1)], ctx()),
      computeWeekVolume([day(2, [2, 2, 3, 3, 2, 2, 2]), other(2)], ctx()),
      computeWeekVolume([day(3, [2, 2, 2, 2, 1, 1, 1])], ctx()),
    ]
    const rows = buildSessionVolume(weeks)
    expect(rows[0]).toMatchObject({ name: 'Día A (piernas) + cadena ant', perWeek: [21, 16, 11] })
    expect(rows[1]).toMatchObject({ name: 'Día B', perWeek: [4, 4, null] })
    expect(weeks.map((w) => w.totalSets)).toEqual([25, 20, 11])
  })
})

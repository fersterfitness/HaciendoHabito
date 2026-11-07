import { describe, expect, it } from 'vitest'
import type { NutritionMeasurement, Student } from '@/types/database'
import { buildAnthropometryReport, buildReportEvolution, defaultReportReading, heathCarter, somatotypeName } from './anthropometryReport'

// Datos de la lámina que hoy arma el nutricionista a mano (primer control de una paciente).
const MEDIANS = {
  peso_bruto_kg: 55,
  talla_corporal_cm: 168,
  talla_sentado_cm: 86.7,
  biacromial_cm: 37.3,
  torax_transverso_cm: 26.7,
  torax_anteroposterior_cm: 18.1,
  biiliocrestideo_cm: 28.5,
  humeral_biepicondilar_cm: 6.3,
  femoral_biepicondilar_cm: 9.1,
  brazo_relajado_cm: 26,
  brazo_flexion_tension_cm: 26.2,
  torax_mesoesternal_cm: 73.2,
  cintura_min_cm: 65,
  cadera_max_cm: 89,
  muslo_max_cm: 54.2,
  muslo_medial_cm: 51,
  pantorrilla_max_cm: 33.2,
  triceps_mm: 5.8,
  subescapular_mm: 5,
  supraespinal_mm: 4,
  abdominal_mm: 7,
  muslo_medial_mm: 14,
  pantorrilla_max_mm: 6.7,
}

function measurement(over: Partial<NutritionMeasurement> & { medians?: Record<string, number> } = {}): NutritionMeasurement {
  const { medians, ...rest } = over
  return {
    id: 'm1',
    owner_id: 'o',
    student_id: 's',
    measured_at: '2026-11-05',
    weight_kg: 55,
    bmi: null,
    body_fat_pct: 27.01,
    muscle_mass_kg: 24.83,
    perimeters_notes: null,
    skinfolds_notes: null,
    notes: null,
    measurement_number: 1,
    height_cm: 168,
    sitting_height_cm: 86.7,
    detail: { medians: medians ?? MEDIANS },
    created_at: '2026-11-05',
    ...rest,
  }
}

const student = { id: 's', full_name: 'Paciente Prueba', birth_date: '1988-01-05', height_cm: null, gender: 'F' } as unknown as Student

describe('buildAnthropometryReport', () => {
  it('da los mismos valores que la lámina hecha a mano', () => {
    const r = buildAnthropometryReport(student, measurement(), null)
    expect(r.isFirst).toBe(true)
    expect(r.fatKg.value).toBeCloseTo(14.86, 2)
    expect(r.musclePct.value).toBeCloseTo(45.15, 2)
    expect(r.bmi.value).toBeCloseTo(19.49, 2)
    expect(r.waistHip.value).toBe(0.73)
    expect(r.waistHeight.value).toBe(0.39)
    expect(r.sum6.value).toBe(42.5)
    expect(r.age).toBe(38)
    expect(r.perimeters.map((p) => p.label)[0]).toBe('Cintura mínima')
  })

  it('marca la dirección de cada cambio respecto del control anterior', () => {
    const prev = measurement({ id: 'm0', measured_at: '2026-10-05', weight_kg: 56, body_fat_pct: 29, muscle_mass_kg: 24.5, medians: { ...MEDIANS, cintura_min_cm: 67, triceps_mm: 5.9 } })
    const r = buildAnthropometryReport(student, measurement(), prev)
    expect(r.isFirst).toBe(false)
    expect(r.fatPct.tone).toBe('good')
    expect(r.muscleKg.tone).toBe('good')
    expect(r.perimeters.find((p) => p.key === 'cintura_min_cm')?.tone).toBe('good')
    // 0,1 mm es ruido de medición
    expect(r.skinfolds.find((p) => p.key === 'triceps_mm')?.tone).toBe('same')
    expect(r.weight.tone).toBe('neutral')
  })
})

describe('heathCarter', () => {
  it('calcula el somatotipo con los datos completos', () => {
    const s = heathCarter(MEDIANS, 55, 168)!
    // Cuenta a mano: X = 14,8 × 170,18 / 168; HWR = 168 / ∛55 = 44,2
    expect(s).toEqual({ endo: 1.3, meso: 3.4, ecto: 3.8 })
    expect(somatotypeName(s)).toBe('Ectomorfo-mesomorfo')
    expect(somatotypeName({ endo: 2, meso: 5, ecto: 1 })).toBe('Mesomorfo endomórfico')
    expect(somatotypeName({ endo: 3, meso: 3.4, ecto: 3 })).toBe('Central')
  })

  it('devuelve null si falta un dato', () => {
    expect(heathCarter({ ...MEDIANS, humeral_biepicondilar_cm: null }, 55, 168)).toBeNull()
  })
})

describe('defaultReportReading', () => {
  it('primer control: describe la línea de base', () => {
    const t = defaultReportReading(buildAnthropometryReport(student, measurement(), null))
    expect(t).toContain('primera evaluación')
    expect(t).toContain('**55,00 kg**')
    expect(t).toContain('**27,01 %**')
  })

  it('control siguiente: cuenta los cambios', () => {
    const prev = measurement({ id: 'm0', weight_kg: 56, body_fat_pct: 29, muscle_mass_kg: 24.5 })
    const t = defaultReportReading(buildAnthropometryReport(student, measurement(), prev))
    expect(t).toContain('tu peso bajó')
    expect(t).toContain('dirección buscada')
  })
})

describe('buildReportEvolution', () => {
  const ms = [
    measurement({ id: 'a', measured_at: '2026-07-01', measurement_number: 1, weight_kg: 60, body_fat_pct: 30, medians: { ...MEDIANS, peso_bruto_kg: 60 } }),
    measurement({ id: 'c', measured_at: '2026-09-01', measurement_number: 3, weight_kg: 57, body_fat_pct: 28, medians: { ...MEDIANS, peso_bruto_kg: 57 } }),
    measurement({ id: 'b', measured_at: '2026-08-01', measurement_number: 2, weight_kg: 58, body_fat_pct: 29, medians: { ...MEDIANS, peso_bruto_kg: 58 } }),
  ]
  it('ordena del más viejo al elegido y marca el cambio total', () => {
    const e = buildReportEvolution(student, ms, 'c')!
    expect(e.controls.map((c) => c.number)).toEqual([1, 2, 3])
    const weight = e.rows.find((r) => r.key === 'weight')!
    expect(weight.values).toEqual([60, 58, 57])
    expect(weight.total.delta).toBe(-3)
    expect(e.rows.find((r) => r.key === 'fatKg')!.total.tone).toBe('good')
  })
  it('no se muestra con menos de tres controles hasta el elegido', () => {
    expect(buildReportEvolution(student, ms, 'b')).toBeNull()
  })
})

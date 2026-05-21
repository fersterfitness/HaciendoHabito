import { fersterGoalLabel, fersterLifestyleLabel } from '@/lib/fersterIntakeLabels'
import type { AnthropometryDetail, AnthropometryMeta } from '@/lib/nutrition/anthropometryProgramModel'
import type { FersterIntakeStored, NutritionIntakeStored, NutritionMeasurement, Student } from '@/types/database'

function detailMeta(m: NutritionMeasurement): AnthropometryMeta | undefined {
  const d = m.detail as AnthropometryDetail | null
  return d?.meta
}

function nextMeasurementNumber(measurements: NutritionMeasurement[]): number {
  let max = 0
  for (const m of measurements) {
    const fromCol = m.measurement_number
    const fromMeta = detailMeta(m)?.measurement_number
    const n = typeof fromCol === 'number' ? fromCol : fromMeta
    if (typeof n === 'number' && n > max) max = n
  }
  return max + 1
}

function sexFromStudent(student: Student): AnthropometryMeta['sex'] {
  if (student.gender === 'M') return 1
  if (student.gender === 'F') return 2
  return null
}

function sportFromIntake(student: Student): string {
  const fi = student.intake_ferster as FersterIntakeStored | null
  if (fi?.main_goal) {
    const label = fersterGoalLabel(fi.main_goal)
    if (fi.main_goal === 'sport') return label
  }
  const ni = student.intake_nutrition as NutritionIntakeStored | null
  const activity = ni?.activity_type?.trim()
  if (activity) return activity
  const hobbies = ni?.hobbies?.trim()
  if (hobbies) return hobbies
  const profession = ni?.profession?.trim()
  if (profession) return profession
  return ''
}

function physicalActivityFromIntake(student: Student): string {
  const ni = student.intake_nutrition as NutritionIntakeStored | null
  if (!ni) {
    const fi = student.intake_ferster as FersterIntakeStored | null
    if (fi?.lifestyle) return fersterLifestyleLabel(fi.lifestyle)
    return ''
  }
  if (ni.has_physical_activity !== 'si') return 'Sin actividad declarada en registro'
  const parts = [
    ni.activity_type?.trim(),
    ni.activity_frequency?.trim(),
    ni.activity_duration?.trim(),
    ni.activity_intensity?.trim(),
  ].filter(Boolean)
  return parts.join(' · ') || ''
}

function latestMeasurement(measurements: NutritionMeasurement[]): NutritionMeasurement | null {
  if (measurements.length === 0) return null
  return [...measurements].sort(
    (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
  )[0]
}

/** Valores por defecto para «Datos generales» al abrir o tras guardar un control. */
export function buildAnthropometryMetaDefaults(
  student: Student,
  measurements: NutritionMeasurement[],
): AnthropometryMeta {
  const last = latestMeasurement(measurements)
  const lastMeta = last ? detailMeta(last) : undefined

  return {
    sport: lastMeta?.sport?.trim() || sportFromIntake(student) || '',
    physical_activity:
      lastMeta?.physical_activity?.trim() || physicalActivityFromIntake(student) || '',
    depo_recrea: lastMeta?.depo_recrea?.trim() || '',
    measurement_number: nextMeasurementNumber(measurements),
    sex: lastMeta?.sex ?? sexFromStudent(student),
    measurement_error_pct_default: lastMeta?.measurement_error_pct_default ?? 2,
  }
}

export type BasicAnthroPrefill = {
  peso_bruto_kg?: number | null
  talla_corporal_cm?: number | null
  talla_sentado_cm?: number | null
}

/** Sugiere peso/talla en serie 1 desde última medición o ficha del paciente. */
export function buildBasicAnthroPrefill(
  student: Student,
  measurements: NutritionMeasurement[],
): BasicAnthroPrefill {
  const last = latestMeasurement(measurements)
  const medians = last ? (last.detail as AnthropometryDetail | null)?.medians : null

  return {
    peso_bruto_kg: medians?.peso_bruto_kg ?? student.weight_kg ?? null,
    talla_corporal_cm: medians?.talla_corporal_cm ?? student.height_cm ?? null,
    talla_sentado_cm: medians?.talla_sentado_cm ?? last?.sitting_height_cm ?? null,
  }
}

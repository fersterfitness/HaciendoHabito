import type { NutritionMeasurement } from '@/types/database'
import type { AnthropometryDetail } from '@/lib/nutrition/anthropometryProgramModel'

function medians(m: NutritionMeasurement) {
  const d = m.detail as AnthropometryDetail | null
  return d?.medians ?? null
}

export function weightOf(m: NutritionMeasurement): number | null {
  return m.weight_kg ?? medians(m)?.peso_bruto_kg ?? null
}

export function waistOf(m: NutritionMeasurement): number | null {
  return medians(m)?.cintura_min_cm ?? null
}

export function fatOf(m: NutritionMeasurement): number | null {
  return m.body_fat_pct ?? null
}

export function muscleOf(m: NutritionMeasurement): number | null {
  return m.muscle_mass_kg ?? null
}

export function bmiOf(m: NutritionMeasurement): number | null {
  return m.bmi ?? null
}

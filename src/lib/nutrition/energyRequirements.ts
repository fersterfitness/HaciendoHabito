/** Mifflin St Jeor (kcal/día) + factor de actividad física. */

export type ActivityFactorKey = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export const ACTIVITY_FACTOR_LABELS: Record<ActivityFactorKey, { label: string; factor: number }> = {
  sedentary: { label: 'Sedentario / poco movimiento', factor: 1.2 },
  light: { label: 'Ligero (1–3 d/sem ejercicio)', factor: 1.375 },
  moderate: { label: 'Moderado (3–5 d/sem)', factor: 1.55 },
  active: { label: 'Activo (6–7 d/sem)', factor: 1.725 },
  very_active: { label: 'Muy activo / deporte intenso', factor: 1.9 },
}

export function ageFromBirthDateIso(birthIso: string | null, refDate = new Date()): number | null {
  if (!birthIso) return null
  const d = new Date(birthIso)
  if (Number.isNaN(d.getTime())) return null
  let age = refDate.getFullYear() - d.getFullYear()
  const m = refDate.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && refDate.getDate() < d.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

export function mifflinStJeorKcal(input: {
  sex: 'M' | 'F' | 'otro' | null
  ageYears: number | null
  weightKg: number | null
  heightCm: number | null
}): number | null {
  const { sex, ageYears, weightKg, heightCm } = input
  if (ageYears == null || weightKg == null || heightCm == null) return null
  if (ageYears < 10 || ageYears > 120) return null
  const w = weightKg
  const h = heightCm
  const base =
    sex === 'F'
      ? 10 * w + 6.25 * h - 5 * ageYears - 161
      : 10 * w + 6.25 * h - 5 * ageYears + 5
  if (!Number.isFinite(base)) return null
  return Math.round(base)
}

export function tdeeKcal(bmr: number | null, activity: ActivityFactorKey): number | null {
  if (bmr == null) return null
  const f = ACTIVITY_FACTOR_LABELS[activity]?.factor ?? 1.2
  return Math.round(bmr * f)
}

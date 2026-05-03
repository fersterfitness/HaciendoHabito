/**
 * Mifflin–St Jeor (kcal/día): TMB y TDEE orientativos.
 * Varón: 10·kg + 6,25·cm − 5·años + 5
 * Mujer: 10·kg + 6,25·cm − 5·años − 161
 */

export function mifflinStJeorBmrMale(weightKg: number, heightCm: number, ageYears: number): number {
  if (![weightKg, heightCm, ageYears].every((n) => Number.isFinite(n) && n > 0)) return NaN
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
}

export function mifflinStJeorBmrFemale(weightKg: number, heightCm: number, ageYears: number): number {
  if (![weightKg, heightCm, ageYears].every((n) => Number.isFinite(n) && n > 0)) return NaN
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161
}

export function tdeeFromBmr(bmr: number, activityFactor: number): number {
  if (!Number.isFinite(bmr) || bmr <= 0) return NaN
  if (!Number.isFinite(activityFactor) || activityFactor <= 0) return NaN
  return bmr * activityFactor
}

/** Guía de factores (texto fijo, alineado al Excel HH). */
export const ACTIVITY_FACTOR_GUIDE_ROWS: { label: string; range: string; detail: string }[] = [
  {
    label: 'Sedentario',
    range: '1,2',
    detail: 'Trabajo sedentario, poca movilidad.',
  },
  {
    label: 'Actividad leve',
    range: '1,3–1,4',
    detail: 'Entrena 3–4 veces/semana ligero, o movilidad habitual.',
  },
  {
    label: 'Moderado',
    range: '1,5–1,6',
    detail: 'Entrena 3–4 con más intensidad, trabajo activo, ~6–8k pasos.',
  },
  {
    label: 'Alto',
    range: '1,7–1,9',
    detail: 'Muy activo/intenso, +10k pasos o deportista de alto rendimiento.',
  },
]

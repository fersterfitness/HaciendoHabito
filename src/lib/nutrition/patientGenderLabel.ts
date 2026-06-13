import { studentGenderLabel } from '@/lib/fersterIntakeLabels'
import type { AnthropometryDetail } from '@/lib/nutrition/anthropometryProgramModel'
import { weightOf } from '@/lib/nutrition/measurementDerivatives'
import type { NutritionMeasurement, Student } from '@/types/database'

function parseWeightKg(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function weightFromIntakeSnapshot(student: Student): number | null {
  const ni = student.intake_nutrition as { personal_snapshot?: { weight_kg?: unknown } } | null
  const fi = student.intake_ferster as { personal_snapshot?: { weight_kg?: unknown } } | null
  const snap = ni?.personal_snapshot ?? fi?.personal_snapshot
  return snap ? parseWeightKg(snap.weight_kg) : null
}

function weightFromLatestMeasurement(measurements: NutritionMeasurement[] | undefined): number | null {
  if (!measurements?.length) return null
  const sorted = [...measurements].sort(
    (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
  )
  for (const m of sorted) {
    const w = weightOf(m)
    if (w != null) return w
  }
  return null
}

function formatWeightKgLabel(kg: number): string {
  return `${String(kg.toFixed(3)).replace(/\.?0+$/, '')} kg`
}

/** Peso en kg: última antropometría → ficha del paciente → registro web. */
export function resolvePatientWeightKg(
  student: Student,
  measurements?: NutritionMeasurement[],
): number | null {
  return (
    weightFromLatestMeasurement(measurements) ??
    parseWeightKg(student.weight_kg) ??
    weightFromIntakeSnapshot(student)
  )
}

/** Texto para PDF / UI (ej. «72.5 kg»). */
export function patientWeightKgLabel(
  student: Student,
  measurements?: NutritionMeasurement[],
): string | null {
  const w = resolvePatientWeightKg(student, measurements)
  return w == null ? null : formatWeightKgLabel(w)
}

function normalizeGenderCode(raw: unknown): Student['gender'] {
  if (raw == null || raw === '') return null
  const s = String(raw).trim().toUpperCase()
  if (s === 'M' || s === 'MALE' || s === 'MASCULINO' || s === 'HOMBRE' || s === 'VARON') return 'M'
  if (s === 'F' || s === 'FEMALE' || s === 'FEMENINO' || s === 'MUJER') return 'F'
  if (s === 'OTRO' || s === 'OTHER' || s === 'X') return 'otro'
  return null
}

function genderFromIntakeSnapshot(student: Student): Student['gender'] {
  const ni = student.intake_nutrition as { personal_snapshot?: { gender?: unknown; gender_other?: unknown } } | null
  const fi = student.intake_ferster as { personal_snapshot?: { gender?: unknown; gender_other?: unknown } } | null
  const snap = ni?.personal_snapshot ?? fi?.personal_snapshot
  if (!snap) return null
  return normalizeGenderCode(snap.gender)
}

function genderOtherFromIntakeSnapshot(student: Student): string | null {
  const ni = student.intake_nutrition as { personal_snapshot?: { gender_other?: unknown } } | null
  const fi = student.intake_ferster as { personal_snapshot?: { gender_other?: unknown } } | null
  const snap = ni?.personal_snapshot ?? fi?.personal_snapshot
  const other = snap?.gender_other
  return typeof other === 'string' && other.trim() ? other.trim() : null
}

function genderFromLatestMeasurement(measurements: NutritionMeasurement[] | undefined): Student['gender'] {
  if (!measurements?.length) return null
  const sorted = [...measurements].sort(
    (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
  )
  for (const m of sorted) {
    const sex = (m.detail as AnthropometryDetail | null)?.meta?.sex
    if (sex === 1) return 'M'
    if (sex === 2) return 'F'
  }
  return null
}

/** Código M/F/otro desde ficha, registro web o última antropometría. */
export function resolveStudentGenderCode(
  student: Student,
  measurements?: NutritionMeasurement[],
): Student['gender'] {
  return (
    normalizeGenderCode(student.gender) ??
    genderFromIntakeSnapshot(student) ??
    genderFromLatestMeasurement(measurements)
  )
}

/** Etiqueta en español para PDF / UI (Masculino, Femenino, Otro, Sin indicar). */
export function patientGenderLabel(
  student: Student,
  measurements?: NutritionMeasurement[],
): string {
  const code = resolveStudentGenderCode(student, measurements)
  if (!code) return 'Sin indicar'
  return studentGenderLabel(code, genderOtherFromIntakeSnapshot(student))
}

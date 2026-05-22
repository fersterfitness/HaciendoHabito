import { supabase } from '@/lib/supabase'
import type { Student } from '@/types/database'

const tagsKey = (id: string) => `tags_${id}`
const cuotaKey = (id: string) => `cuota_mensual_${id}`
const goalKey = (id: string) => `peso_goal_${id}`

export type StudentTrainerPrefsPatch = {
  trainer_tags?: string[]
  monthly_fee_amount?: number | null
  target_weight_kg?: number | null
}

function readLocalTags(studentId: string): string[] | undefined {
  try {
    const raw = localStorage.getItem(tagsKey(studentId))
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return undefined
    return parsed.filter((t): t is string => typeof t === 'string').map((t) => t.trim().toLowerCase()).filter(Boolean)
  } catch {
    return undefined
  }
}

function readLocalPositiveNumber(key: string): number | undefined {
  const raw = localStorage.getItem(key)
  if (!raw) return undefined
  const n = Number(raw)
  return !Number.isNaN(n) && n > 0 ? n : undefined
}

/** Lee valores legacy en localStorage (un solo dispositivo). */
export function readLocalTrainerPrefs(studentId: string): StudentTrainerPrefsPatch {
  const patch: StudentTrainerPrefsPatch = {}
  const tags = readLocalTags(studentId)
  if (tags?.length) patch.trainer_tags = tags
  const cuota = readLocalPositiveNumber(cuotaKey(studentId))
  if (cuota != null) patch.monthly_fee_amount = cuota
  const goal = readLocalPositiveNumber(goalKey(studentId))
  if (goal != null) patch.target_weight_kg = goal
  return patch
}

export function clearLocalTrainerPrefs(studentId: string): void {
  try {
    localStorage.removeItem(tagsKey(studentId))
    localStorage.removeItem(cuotaKey(studentId))
    localStorage.removeItem(goalKey(studentId))
  } catch {
    /* ignore */
  }
}

export async function updateStudentTrainerPrefs(
  studentId: string,
  patch: StudentTrainerPrefsPatch,
): Promise<string | null> {
  const { error } = await supabase.from('students').update(patch).eq('id', studentId)
  return error?.message ?? null
}

/** Etiquetas del alumno (columna `trainer_tags`, con fallback vacío). */
export function studentTrainerTags(student: Pick<Student, 'trainer_tags'>): string[] {
  return student.trainer_tags ?? []
}

/** Cuota mensual: DB primero; opcional fallback legacy en localStorage. */
export function studentMonthlyFeeAmount(
  student: Pick<Student, 'id' | 'monthly_fee_amount'>,
): number | null {
  if (student.monthly_fee_amount != null && student.monthly_fee_amount > 0) {
    return student.monthly_fee_amount
  }
  const legacy = readLocalPositiveNumber(cuotaKey(student.id))
  return legacy ?? null
}

/** Arma el patch de migración localStorage → DB (lógica pura, testeable). */
export function buildTrainerPrefsMigratePatch(
  student: Student,
  local: StudentTrainerPrefsPatch,
): StudentTrainerPrefsPatch {
  const base = {
    ...student,
    trainer_tags: student.trainer_tags ?? [],
    monthly_fee_amount: student.monthly_fee_amount ?? null,
    target_weight_kg: student.target_weight_kg ?? null,
  }
  const patch: StudentTrainerPrefsPatch = {}
  if (base.trainer_tags.length === 0 && local.trainer_tags?.length) {
    patch.trainer_tags = local.trainer_tags
  }
  if (base.monthly_fee_amount == null && local.monthly_fee_amount != null) {
    patch.monthly_fee_amount = local.monthly_fee_amount
  }
  if (base.target_weight_kg == null && local.target_weight_kg != null) {
    patch.target_weight_kg = local.target_weight_kg
  }
  return patch
}

/**
 * Si la base está vacía y localStorage tiene datos, sube una vez y limpia el storage local.
 */
function withTrainerPrefsDefaults(student: Student): Student {
  return {
    ...student,
    trainer_tags: student.trainer_tags ?? [],
    monthly_fee_amount: student.monthly_fee_amount ?? null,
    target_weight_kg: student.target_weight_kg ?? null,
  }
}

export async function migrateLocalTrainerPrefsToDb(student: Student): Promise<Student> {
  const base = withTrainerPrefsDefaults(student)
  const local = readLocalTrainerPrefs(base.id)
  const patch = buildTrainerPrefsMigratePatch(base, local)

  if (Object.keys(patch).length === 0) return base

  const err = await updateStudentTrainerPrefs(base.id, patch)
  if (err) return base

  clearLocalTrainerPrefs(base.id)
  return { ...base, ...patch }
}

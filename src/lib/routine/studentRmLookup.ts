import { supabase } from '@/lib/supabase'

export type StudentRmLookup = {
  byExerciseId: Map<string, number>
  byExerciseName: Map<string, number>
}

function normalizeExerciseName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Último 1RM por ejercicio del alumno (testeado o Epley). */
export async function fetchStudentRmLookup(studentId: string): Promise<StudentRmLookup> {
  const byExerciseId = new Map<string, number>()
  const byExerciseName = new Map<string, number>()

  const { data, error } = await supabase
    .from('student_rm_records')
    .select('exercise_id, rm_kg, tested_at, exercise:exercise_library(id, name)')
    .eq('student_id', studentId)
    .order('tested_at', { ascending: false })

  if (error) {
    if (import.meta.env.DEV) console.warn('[studentRmLookup]', error.message)
    return { byExerciseId, byExerciseName }
  }

  for (const row of data ?? []) {
    const kg = Number(row.rm_kg)
    if (!Number.isFinite(kg) || kg <= 0) continue
    if (!byExerciseId.has(row.exercise_id)) byExerciseId.set(row.exercise_id, kg)
    const rawName = (row.exercise as { name?: string } | null)?.name
    if (rawName) {
      const key = normalizeExerciseName(rawName)
      if (!byExerciseName.has(key)) byExerciseName.set(key, kg)
    }
  }

  return { byExerciseId, byExerciseName }
}

export function resolveRmKgForExercise(
  lookup: StudentRmLookup,
  exerciseId: string,
  exerciseName?: string | null,
): number | undefined {
  const direct = lookup.byExerciseId.get(exerciseId)
  if (direct != null) return direct
  if (exerciseName) {
    const byName = lookup.byExerciseName.get(normalizeExerciseName(exerciseName))
    if (byName != null) return byName
  }
  return undefined
}

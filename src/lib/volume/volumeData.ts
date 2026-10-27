import { supabase } from '@/lib/supabase'
import { buildExerciseTechnicalNotes, parseExerciseMeta } from '@/lib/routine/exerciseMeta'
import {
  cleanFactors,
  DEFAULT_VOLUME_SETTINGS,
  normalizeVolumeSettings,
  type MuscleFactors,
  type TechniqueId,
  type VolumeSettings,
} from '@/lib/volume/trainingVolume'

export type VolumeProfile = {
  id: string
  name: string
  settings: VolumeSettings
  is_default: boolean
}

export const VOLUME_SQL_HINT =
  'Falta ejecutar la migración 20261027130000_training_volume.sql en Supabase para guardar ajustes de volumen.'

/** Perfil de fábrica (cuando el entrenador todavía no guardó ninguno). */
export const FACTORY_PROFILE: VolumeProfile = {
  id: 'factory',
  name: 'Por defecto',
  settings: DEFAULT_VOLUME_SETTINGS,
  is_default: true,
}

export type VolumeData = {
  profiles: VolumeProfile[]
  factorOverrides: Map<string, MuscleFactors>
  methodNames: Map<string, string>
  /** false si las tablas todavía no existen (migración sin correr). */
  tablesReady: boolean
}

export async function loadVolumeData(): Promise<VolumeData> {
  const [profilesRes, factorsRes, methodsRes] = await Promise.all([
    supabase.from('trainer_volume_profiles').select('id, name, settings, is_default').order('created_at'),
    supabase.from('exercise_volume_factors').select('exercise_id, factors'),
    supabase.from('training_methods').select('id, name'),
  ])
  const tablesReady = !profilesRes.error && !factorsRes.error
  const profiles: VolumeProfile[] = ((profilesRes.data ?? []) as { id: string; name: string; settings: unknown; is_default: boolean }[]).map(
    (p) => ({ id: p.id, name: p.name, is_default: p.is_default, settings: normalizeVolumeSettings(p.settings) }),
  )
  const factorOverrides = new Map<string, MuscleFactors>()
  for (const row of (factorsRes.data ?? []) as { exercise_id: string; factors: unknown }[]) {
    factorOverrides.set(row.exercise_id, cleanFactors(row.factors))
  }
  const methodNames = new Map<string, string>()
  for (const m of (methodsRes.data ?? []) as { id: string; name: string }[]) methodNames.set(m.id, m.name)
  return { profiles: profiles.length ? profiles : [FACTORY_PROFILE], factorOverrides, methodNames, tablesReady }
}

export async function saveExerciseFactors(exerciseId: string, factors: MuscleFactors | null): Promise<string | null> {
  const { error } = factors
    ? await supabase
        .from('exercise_volume_factors')
        .upsert({ exercise_id: exerciseId, factors, updated_at: new Date().toISOString() }, { onConflict: 'owner_id,exercise_id' })
    : await supabase.from('exercise_volume_factors').delete().eq('exercise_id', exerciseId)
  if (error) return /does not exist|schema cache/i.test(error.message) ? VOLUME_SQL_HINT : error.message
  return null
}

/** Crea (sin id o perfil de fábrica) o actualiza un perfil. Si es por defecto, desmarca los demás. */
export async function saveVolumeProfile(profile: VolumeProfile): Promise<{ id: string | null; error: string | null }> {
  const payload = { name: profile.name.trim() || 'Perfil', settings: profile.settings, is_default: profile.is_default, updated_at: new Date().toISOString() }
  const isNew = !profile.id || profile.id === FACTORY_PROFILE.id
  const res = isNew
    ? await supabase.from('trainer_volume_profiles').insert(payload).select('id').single()
    : await supabase.from('trainer_volume_profiles').update(payload).eq('id', profile.id).select('id').single()
  if (res.error) {
    return { id: null, error: /does not exist|schema cache/i.test(res.error.message) ? VOLUME_SQL_HINT : res.error.message }
  }
  const id = (res.data as { id: string }).id
  if (profile.is_default) {
    await supabase.from('trainer_volume_profiles').update({ is_default: false }).neq('id', id)
  }
  return { id, error: null }
}

export async function deleteVolumeProfile(id: string): Promise<string | null> {
  const { error } = await supabase.from('trainer_volume_profiles').delete().eq('id', id)
  return error?.message ?? null
}

/** Guarda la técnica elegida a mano en el META del ejercicio de la rutina (null = volver a detectar). */
export async function saveRoutineExerciseTechnique(
  routineExerciseId: string,
  technicalNotes: string | null,
  technique: TechniqueId | null,
): Promise<{ notes: string; error: string | null }> {
  const { userNotes, meta } = parseExerciseMeta(technicalNotes)
  const nextMeta = { ...meta }
  if (technique) nextMeta.volumeTechnique = technique
  else delete nextMeta.volumeTechnique
  const notes = buildExerciseTechnicalNotes(userNotes, nextMeta)
  const { error } = await supabase.from('routine_exercises').update({ technical_notes: notes }).eq('id', routineExerciseId)
  return { notes, error: error?.message ?? null }
}

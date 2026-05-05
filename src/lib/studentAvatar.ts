import { supabase } from '@/lib/supabase'

export const STUDENT_AVATAR_BUCKET = 'student-avatars'

/** Tamaño máximo por imagen de perfil de alumno (5 MB). */
export const STUDENT_AVATAR_MAX_BYTES = 5 * 1024 * 1024

/** URL pública para cualquier objeto en el bucket de alumnos (avatar, progreso, etc.). */
export function studentBucketPublicUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath?.trim()) return null
  const { data } = supabase.storage.from(STUDENT_AVATAR_BUCKET).getPublicUrl(storagePath.trim())
  return data.publicUrl
}

/** URL pública del avatar si existe `avatar_path` en Storage (bucket público). */
export function studentAvatarPublicUrl(path: string | null | undefined): string | null {
  return studentBucketPublicUrl(path)
}

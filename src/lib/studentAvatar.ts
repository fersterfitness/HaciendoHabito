import { supabase } from '@/lib/supabase'

export const STUDENT_AVATAR_BUCKET = 'student-avatars'

/** Tamaño máximo por imagen de perfil de alumno (5 MB). */
export const STUDENT_AVATAR_MAX_BYTES = 5 * 1024 * 1024

/** URL pública del avatar si existe `avatar_path` en Storage (bucket público). */
export function studentAvatarPublicUrl(path: string | null | undefined): string | null {
  if (!path?.trim()) return null
  const { data } = supabase.storage.from(STUDENT_AVATAR_BUCKET).getPublicUrl(path.trim())
  return data.publicUrl
}

import { supabase } from '@/lib/supabase'

export const PROFILE_AVATAR_BUCKET = 'profile-avatars'

export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024

/** Aceptadas en subida */
export function profileAvatarExtFromFile(file: File): string | null {
  const raw = file.name.split('.').pop()?.toLowerCase()
  if (raw === 'jpg' || raw === 'jpeg' || raw === 'png' || raw === 'webp') return raw === 'jpeg' ? 'jpg' : raw
  const t = file.type
  if (t === 'image/jpeg') return 'jpg'
  if (t === 'image/png') return 'png'
  if (t === 'image/webp') return 'webp'
  return null
}

/**
 * `profiles.avatar_url`: ruta en bucket `profile-avatars` (ej. `{uuid}/avatar.jpg`)
 * o URL absoluta si en el futuro se guarda así.
 */
export function profileAvatarDisplayUrl(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null
  const s = stored.trim()
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  const { data } = supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(s)
  return data.publicUrl
}

/** Ruta en bucket (para borrar/al reemplazar). Si es URL externa legada, devuelve null. */
export function profileAvatarStoragePath(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null
  const s = stored.trim()
  if (s.startsWith('http://') || s.startsWith('https://')) return null
  return s
}

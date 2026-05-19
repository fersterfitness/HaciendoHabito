import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn, getInitials } from '@/lib/utils'

export const STUDENT_AVATAR_BUCKET = 'student-avatars'

/** Tamaño máximo por imagen de perfil de alumno (5 MB). */
export const STUDENT_AVATAR_MAX_BYTES = 5 * 1024 * 1024

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

/** URL firmada (bucket privado). */
export async function studentBucketSignedUrl(
  storagePath: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!storagePath?.trim()) return null
  const key = storagePath.trim()
  const cached = signedUrlCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const { data, error } = await supabase.storage.from(STUDENT_AVATAR_BUCKET).createSignedUrl(key, expiresIn)
  if (error || !data?.signedUrl) return null
  signedUrlCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + (expiresIn - 60) * 1000 })
  return data.signedUrl
}

/** @deprecated Usar `studentBucketSignedUrl` o `useStudentStorageUrl`. */
export function studentBucketPublicUrl(storagePath: string | null | undefined): string | null {
  void storagePath
  return null
}

export function studentAvatarPublicUrl(path: string | null | undefined): string | null {
  void path
  return null
}

type StudentPhotoImgProps = {
  storagePath: string | null | undefined
  alt: string
  className?: string
  onClick?: () => void
}

/** Imagen con URL firmada (bucket privado). */
export function StudentPhotoImg({ storagePath, alt, className, onClick }: StudentPhotoImgProps) {
  const url = useStudentStorageUrl(storagePath)
  if (!url) return null
  return <img src={url} alt={alt} className={className} onClick={onClick} />
}

type StudentAvatarThumbProps = {
  storagePath?: string | null
  name: string
  className?: string
  fallbackClassName?: string
}

/** Miniatura en tablas/listas (URL firmada o iniciales). */
export function StudentAvatarThumb({ storagePath, name, className, fallbackClassName }: StudentAvatarThumbProps) {
  const url = useStudentStorageUrl(storagePath)
  const box = className ?? 'h-6 w-6 shrink-0 rounded-md border border-surface-border'
  if (url) {
    return <img src={url} alt="" className={cn(box, 'object-cover')} />
  }
  return (
    <div
      className={cn(
        box,
        'flex items-center justify-center bg-surface-elevated/60 text-[10px] font-semibold text-ink-muted',
        fallbackClassName,
      )}
      aria-hidden
    >
      {getInitials(name) || name.charAt(0).toUpperCase()}
    </div>
  )
}

/** Hook para `<img src>` de avatares / fotos en bucket privado. */
export function useStudentStorageUrl(storagePath: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void studentBucketSignedUrl(storagePath).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [storagePath])
  return url
}

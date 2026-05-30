import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PROFILE_AVATAR_BUCKET,
  PROFILE_AVATAR_MAX_BYTES,
  profileAvatarExtFromFile,
  profileAvatarStoragePath,
} from '@/lib/profileAvatar'
import { useAuthStore } from '@/stores/authStore'
import { AvatarOrInitials } from '@/components/account/AvatarOrInitials'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'
import type { Profile } from '@/types/database'

const ACCEPT = 'image/jpeg,image/png,image/webp'

interface Props {
  profile: Profile
  onUpdated: (p: Profile) => void
}

export function SettingsProfilePhotoSection({ profile, onUpdated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore((s) => s.user)
  const [busy, setBusy] = useState(false)

  async function upload(file: File) {
    if (!user?.id) return
    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      toast.error('La imagen debe pesar como máximo 5 MB')
      return
    }
    const ext = profileAvatarExtFromFile(file)
    if (!ext) {
      toast.error('Usá JPG, PNG o WebP')
      return
    }

    setBusy(true)
    try {
      const prevPath = profileAvatarStoragePath(profile.avatar_url)
      if (prevPath) {
        await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([prevPath])
      }
      // Nombre único por subida: la URL pública es estable por path, así que si
      // reusáramos `avatar.<ext>` el navegador/CDN seguiría mostrando la foto
      // cacheada y "no se cambiaría". El timestamp fuerza una URL nueva.
      const path = `${user.id}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      })
      if (upErr) {
        toast.error(`No se pudo subir la foto: ${upErr.message}`)
        return
      }

      const { data, error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: path })
        .eq('id', user.id)
        .select()
        .single()

      if (dbErr) {
        toast.error(dbErr.message)
        await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([path])
        return
      }

      onUpdated(data as Profile)
      toast.success('Foto de perfil actualizada')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removePhoto() {
    if (!user?.id || busy) return
    const prevPath = profileAvatarStoragePath(profile.avatar_url)
    setBusy(true)
    try {
      if (prevPath) {
        await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([prevPath])
      }
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)
        .select()
        .single()
      if (error) {
        toast.error(error.message)
        return
      }
      onUpdated(data as Profile)
      toast.success('Foto quitada')
    } finally {
      setBusy(false)
    }
  }

  const hasAnyAvatar = Boolean(profile.avatar_url?.trim())

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="relative inline-flex shrink-0">
        <AvatarOrInitials fullName={profile.full_name} avatarUrl={profile.avatar_url} size="lg" />
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
          }}
        />
        <button
          type="button"
          disabled={busy}
          title="Cambiar foto"
          onClick={() => inputRef.current?.click()}
          className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-xl border border-surface-border bg-surface-card text-ink-secondary shadow-md hover:bg-surface-elevated hover:text-ink-primary disabled:opacity-50"
        >
          <Camera className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-medium text-ink-primary">Foto de perfil</p>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Se muestra en el panel (barra lateral y encabezado). JPG, PNG o WebP, hasta 5 MB.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
            Subir foto
          </Button>
          {hasAnyAvatar && (
            <Button type="button" size="sm" variant="ghost" loading={busy} onClick={() => void removePhoto()}>
              Quitar foto
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

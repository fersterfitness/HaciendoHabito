import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, getInitials } from '@/lib/utils'
import {
  STUDENT_AVATAR_BUCKET,
  STUDENT_AVATAR_MAX_BYTES,
  studentAvatarPublicUrl,
} from '@/lib/studentAvatar'
import toast from 'react-hot-toast'

const ACCEPT = 'image/jpeg,image/png,image/webp'

function extFromFile(file: File): string | null {
  const raw = file.name.split('.').pop()?.toLowerCase()
  if (raw === 'jpg' || raw === 'jpeg' || raw === 'png' || raw === 'webp') return raw === 'jpeg' ? 'jpg' : raw
  const t = file.type
  if (t === 'image/jpeg') return 'jpg'
  if (t === 'image/png') return 'png'
  if (t === 'image/webp') return 'webp'
  return null
}

type Props = {
  studentId: string
  fullName: string
  avatarPath: string | null
  /** `sm` listado, `md` compacto, `lg` ficha destacada */
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Dentro de una fila clicable: evita navegar al hacer clic en la foto */
  stopRowNavigation?: boolean
  allowRemove?: boolean
  onPathChange: (nextPath: string | null) => void
}

export function StudentAvatar({
  studentId,
  fullName,
  avatarPath,
  size = 'sm',
  className,
  stopRowNavigation,
  allowRemove,
  onPathChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [brokenImg, setBrokenImg] = useState(false)

  const url = studentAvatarPublicUrl(avatarPath)
  const showPhoto = Boolean(url && !brokenImg)

  const dim =
    size === 'lg'
      ? 'w-[7.5rem] h-[7.5rem] sm:w-36 sm:h-36 rounded-2xl text-3xl sm:text-4xl'
      : size === 'md'
        ? 'w-14 h-14 rounded-2xl text-lg'
        : 'w-8 h-8 rounded-lg text-xs'

  const overlayRounded = size === 'sm' ? 'rounded-lg' : 'rounded-2xl'

  async function upload(file: File) {
    if (file.size > STUDENT_AVATAR_MAX_BYTES) {
      toast.error('La imagen debe pesar como máximo 5 MB')
      return
    }
    const ext = extFromFile(file)
    if (!ext) {
      toast.error('Usá JPG, PNG o WebP')
      return
    }

    setBusy(true)
    try {
      if (avatarPath) {
        await supabase.storage.from(STUDENT_AVATAR_BUCKET).remove([avatarPath])
      }
      const path = `${studentId}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from(STUDENT_AVATAR_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      })
      if (upErr) {
        toast.error(`Storage: ${upErr.message}`)
        return
      }

      const { error: dbErr } = await supabase
        .from('students')
        .update({ avatar_path: path })
        .eq('id', studentId)
      if (dbErr) {
        toast.error(`Perfil: ${dbErr.message}`)
        await supabase.storage.from(STUDENT_AVATAR_BUCKET).remove([path])
        return
      }

      setBrokenImg(false)
      onPathChange(path)
      toast.success('Foto actualizada')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removePhoto(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!avatarPath || busy) return
    setBusy(true)
    try {
      await supabase.storage.from(STUDENT_AVATAR_BUCKET).remove([avatarPath])
      const { error } = await supabase.from('students').update({ avatar_path: null }).eq('id', studentId)
      if (error) {
        toast.error(`Perfil: ${error.message}`)
        return
      }
      setBrokenImg(false)
      onPathChange(null)
      toast.success('Foto quitada')
    } finally {
      setBusy(false)
    }
  }

  function openPicker(e: React.MouseEvent) {
    if (stopRowNavigation) {
      e.stopPropagation()
    }
    if (busy) return
    inputRef.current?.click()
  }

  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      <button
        type="button"
        title="Cambiar foto"
        aria-label="Cambiar foto del alumno"
        disabled={busy}
        onClick={openPicker}
        className={cn(
          dim,
          'relative overflow-hidden flex items-center justify-center font-bold text-brand-primary',
          'bg-brand-primary/10 hover:bg-brand-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50',
          busy && 'opacity-60 pointer-events-none',
          showPhoto ? 'ring-0 p-0 bg-surface-elevated' : '',
        )}
      >
        {showPhoto ? (
          <img
            src={url!}
            alt={fullName}
            className="absolute inset-0 box-border h-full w-full object-contain object-center p-1"
            onError={() => setBrokenImg(true)}
          />
        ) : (
          <span className="relative z-[1]">{getInitials(fullName)}</span>
        )}
        <span
          className={cn(
            'absolute inset-0 z-[2] flex items-center justify-center bg-black/45 text-white opacity-0 hover:opacity-100 transition-opacity',
            overlayRounded,
          )}
        >
          <Camera
            className={
              size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-5 w-5' : 'h-7 w-7'
            }
            aria-hidden
          />
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void upload(f)
        }}
      />

      {allowRemove && avatarPath ? (
        <button
          type="button"
          title="Quitar foto"
          onClick={removePhoto}
          disabled={busy}
          className={cn(
            'absolute z-[3] flex items-center justify-center rounded-full bg-surface-card border border-surface-border font-bold text-ink-muted hover:text-status-expired hover:border-status-expired/40 shadow-sm',
            size === 'lg'
              ? '-top-2 -right-2 h-8 w-8 text-sm'
              : '-top-1 -right-1 h-5 w-5 text-[10px]',
          )}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

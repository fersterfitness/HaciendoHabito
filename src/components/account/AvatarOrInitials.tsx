import { useEffect, useState } from 'react'
import { cn, getInitials } from '@/lib/utils'
import { profileAvatarDisplayUrl } from '@/lib/profileAvatar'

type Size = 'sm' | 'md' | 'lg'

const sizeClasses: Record<Size, string> = {
  sm: 'size-[34px] text-[10px]',
  md: 'size-9 text-xs',
  lg: 'size-14 text-lg sm:size-16 sm:text-xl',
}

interface AvatarOrInitialsProps {
  fullName: string
  avatarUrl: string | null | undefined
  size?: Size
  rounded?: 'full' | 'xl'
  /** Clases para el fondo cuando no hay foto o mientras falla la imagen */
  fallbackClassName?: string
  className?: string
}

/** Foto de perfil (profiles.avatar_url) o iniciales. */
export function AvatarOrInitials({
  fullName,
  avatarUrl,
  size = 'sm',
  rounded = 'full',
  fallbackClassName,
  className,
}: AvatarOrInitialsProps) {
  const [broken, setBroken] = useState(false)
  const src = profileAvatarDisplayUrl(avatarUrl)
  // Si cambia la foto (nueva URL), olvidamos un error previo para reintentar cargarla.
  useEffect(() => {
    setBroken(false)
  }, [src])
  const showImg = Boolean(src && !broken)

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden font-bold uppercase tracking-tight',
        rounded === 'full' ? 'rounded-full' : 'rounded-xl',
        sizeClasses[size],
        showImg ? 'bg-black/5 dark:bg-white/10' : cn('bg-zinc-300 text-zinc-900 dark:bg-white/12 dark:text-white', fallbackClassName),
        className,
      )}
    >
      {showImg ? (
        <img
          src={src!}
          alt=""
          // `object-top`: las fotos de perfil suelen tener la cabeza arriba; anclar
          // el recorte al tope evita cortar la frente/cabeza (look "cortado").
          className="block size-full object-cover object-top"
          onError={() => setBroken(true)}
        />
      ) : (
        getInitials(fullName)
      )}
    </span>
  )
}

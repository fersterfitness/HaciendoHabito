import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { webIntakeCatalogDisplayUrl } from '@/lib/webIntakeCatalogAssets'

const INTAKE_AVATAR_PX: Record<string, number> = {
  'h-8 w-8': 32,
  'h-10 w-10': 40,
  'h-12 w-12': 48,
  'h-14 w-14': 56,
  'h-16 w-16': 64,
}

export function initialsFromProfessionalName(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase()
}

/** Cuadrado con esquinas redondeadas (alineado a inputs / tarjetas), no óvalo ni cápsula. */
export function IntakeProAvatar({
  label,
  url,
  sizeClass = 'h-14 w-14',
  theme = 'dark',
  priority = false,
}: {
  label: string
  url?: string | null
  sizeClass?: string
  theme?: 'light' | 'dark'
  /** true = eager + fetchpriority (fotos visibles al cargar el paso). */
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [useOriginalSrc, setUseOriginalSrc] = useState(false)
  const cssPx = INTAKE_AVATAR_PX[sizeClass] ?? 56
  const rawSrc = url?.trim() || null
  const isCatalogAsset = Boolean(rawSrc?.includes('/web-intake-catalog/'))
  const preferRaw =
    !isCatalogAsset ||
    (typeof window !== 'undefined' &&
      (window.matchMedia('(max-width: 639px)').matches || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)))
  const optimizedSrc = preferRaw ? rawSrc : webIntakeCatalogDisplayUrl(url, cssPx)
  const imgSrc = useOriginalSrc ? rawSrc : optimizedSrc ?? rawSrc

  useEffect(() => {
    setFailed(false)
    setUseOriginalSrc(false)
  }, [url])

  const showImg = Boolean(imgSrc && !failed)
  return showImg ? (
    <img
      src={imgSrc!}
      alt=""
      width={cssPx}
      height={cssPx}
      className={cn(
        sizeClass,
        'shrink-0 rounded-xl object-cover object-[center_18%] ring-1',
        theme === 'light' ? 'ring-neutral-200/80' : 'ring-white/20',
      )}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => {
        if (!useOriginalSrc && rawSrc && optimizedSrc !== rawSrc) {
          setUseOriginalSrc(true)
          return
        }
        setFailed(true)
      }}
    />
  ) : (
    <span
      className={cn(
        sizeClass,
        'flex shrink-0 items-center justify-center rounded-lg px-0.5 text-[9px] font-bold uppercase leading-tight ring-1',
        theme === 'light'
          ? 'bg-neutral-200/90 text-neutral-800 ring-neutral-300/70'
          : 'bg-white/12 text-white/90 ring-white/15',
      )}
      aria-hidden
    >
      {initialsFromProfessionalName(label)}
    </span>
  )
}

export type IntakeProfessionalHighlight = {
  id: string
  roleLabel: string
  name: string
  credential: string
  avatarUrl: string | null
}

/** Fila compacta: foto + rol + nombre + credencial (tarjetas de plan / ofertas). */
export function IntakeProfessionalMiniCard({
  roleLabel,
  name,
  credential,
  avatarUrl,
  theme = 'dark',
}: Omit<IntakeProfessionalHighlight, 'id'> & { theme?: 'light' | 'dark' }) {
  const isDark = theme === 'dark'
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-2',
        isDark ? 'border-white/10 bg-white/[0.04]' : 'border-surface-border/80 bg-surface-elevated/40',
      )}
    >
      <IntakeProAvatar label={name} url={avatarUrl} sizeClass="h-11 w-11" theme={theme} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[9px] font-bold uppercase tracking-[0.1em]',
            isDark ? 'text-white/45' : 'text-ink-muted',
          )}
        >
          {roleLabel}
        </p>
        <p className={cn('text-[12px] font-semibold leading-tight', isDark ? 'text-white' : 'text-ink-primary')}>
          {name}
        </p>
        {credential.trim() ? (
          <p
            className={cn(
              'mt-0.5 text-[10px] leading-snug line-clamp-2',
              isDark ? 'text-white/65' : 'text-ink-secondary',
            )}
          >
            {credential.trim()}
          </p>
        ) : null}
      </div>
    </div>
  )
}

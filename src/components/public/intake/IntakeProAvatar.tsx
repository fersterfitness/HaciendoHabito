import { useEffect, useId, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { webIntakeCatalogDisplayUrl } from '@/lib/webIntakeCatalogAssets'
import { IntakeProPhotoLightbox } from '@/components/public/intake/IntakeProPhotoLightbox'

const INTAKE_AVATAR_PX: Record<string, number> = {
  'h-8 w-8': 32,
  'h-10 w-10': 40,
  'h-11 w-11': 44,
  'h-12 w-12': 48,
  'h-14 w-14': 56,
  'h-16 w-16': 64,
  'h-[4.5rem] w-[4.5rem]': 72,
  'h-20 w-20': 80,
  'h-full w-full': 80,
}

/** Encuadre según tipo de foto subida al catálogo. */
export type IntakeProAvatarFocus = 'standard' | 'face' | 'headshot'

const AVATAR_FOCUS: Record<
  IntakeProAvatarFocus,
  { objectPosition: string; scale: string; renderScale: number }
> = {
  standard: { objectPosition: 'object-center', scale: 'scale-100', renderScale: 2 },
  face: { objectPosition: 'object-[center_22%]', scale: 'scale-110', renderScale: 2.25 },
  /** Plano amplio / cuerpo entero en listas «Incluye». */
  headshot: { objectPosition: 'object-center', scale: 'scale-100', renderScale: 2 },
}

/** Encuadre en bloques «Incluye» (miniatura). */
export function intakeProAvatarFocusForRole(
  role: 'trainer' | 'nutritionist' | 'psychologist',
): IntakeProAvatarFocus {
  return role === 'psychologist' ? 'headshot' : 'face'
}

export function initialsFromProfessionalName(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase()
}

function photoLayoutIds(label: string, reactId: string) {
  const slug = label.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24) || 'pro'
  return {
    groupId: `intake-pro-lg-${reactId}`,
    imageId: `intake-pro-img-${slug}-${reactId}`,
  }
}

/** Cuadrado con esquinas redondeadas; opcional tap para ampliar con animación. */
export function IntakeProAvatar({
  label,
  url,
  sizeClass = 'h-14 w-14',
  theme = 'dark',
  priority = false,
  focus = 'face',
  expandable = false,
  shape = 'rounded',
  imageFit = 'cover',
  useOriginalImage = false,
  noRing = false,
}: {
  label: string
  url?: string | null
  sizeClass?: string
  theme?: 'light' | 'dark'
  priority?: boolean
  focus?: IntakeProAvatarFocus
  expandable?: boolean
  shape?: 'rounded' | 'circle'
  imageFit?: 'cover' | 'contain'
  useOriginalImage?: boolean
  /** Sin borde/ring externo (para fotos flotantes en hero). */
  noRing?: boolean
}) {
  const reactId = useId()
  const { groupId, imageId } = photoLayoutIds(label, reactId)
  const [failed, setFailed] = useState(false)
  const [useOriginalSrc, setUseOriginalSrc] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const cssPx = INTAKE_AVATAR_PX[sizeClass] ?? 56
  const rawSrc = url?.trim() || null
  const isCatalogAsset = Boolean(rawSrc?.includes('/web-intake-catalog/'))
  const preferRaw =
    useOriginalImage ||
    imageFit === 'contain' ||
    !isCatalogAsset ||
    (typeof window !== 'undefined' &&
      (window.matchMedia('(max-width: 639px)').matches || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)))
  const focusStyle = AVATAR_FOCUS[focus]
  const optimizedSrc = preferRaw
    ? rawSrc
    : webIntakeCatalogDisplayUrl(url, cssPx, focusStyle.renderScale)
  const imgSrc = useOriginalSrc ? rawSrc : optimizedSrc ?? rawSrc

  useEffect(() => {
    setFailed(false)
    setUseOriginalSrc(false)
    setLightboxOpen(false)
  }, [url])

  const ringClass = theme === 'light' ? 'ring-neutral-200/80' : 'ring-white/20'
  const showImg = Boolean(imgSrc && !failed)
  const canExpand = expandable && Boolean(rawSrc && showImg)

  const imgClassName = cn(
    'h-full w-full',
    imageFit === 'contain' ? 'object-contain' : 'object-cover',
    focusStyle.objectPosition,
    imageFit === 'cover' ? focusStyle.scale : '',
  )

  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg'
  const thumbFrameClass = cn(
    sizeClass,
    'relative shrink-0 overflow-hidden',
    !noRing && 'ring-1',
    radiusClass,
    !noRing && ringClass,
    imageFit === 'contain' && (theme === 'light' ? 'bg-neutral-100/90' : 'bg-white/[0.06]'),
  )

  if (showImg && canExpand) {
    return (
      <LayoutGroup id={groupId}>
        {!lightboxOpen ? (
          <motion.button
            type="button"
            layout={false}
            className={cn(
              thumbFrameClass,
              'cursor-pointer transition-shadow hover:ring-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
            )}
            aria-label={`Ver foto de ${label}`}
            onClick={() => setLightboxOpen(true)}
            whileTap={{ scale: 0.96 }}
          >
            <motion.img
              layoutId={imageId}
              src={imgSrc!}
              alt=""
              width={cssPx}
              height={cssPx}
              className={imgClassName}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onError={() => {
                if (!useOriginalSrc && rawSrc && optimizedSrc !== rawSrc) {
                  setUseOriginalSrc(true)
                  return
                }
                setFailed(true)
              }}
            />
          </motion.button>
        ) : null}
        <AnimatePresence>
          {lightboxOpen && rawSrc ? (
            <IntakeProPhotoLightbox
              key="open"
              src={rawSrc}
              alt={label}
              layoutId={imageId}
              layoutGroupId={groupId}
              focus={focus}
              onClose={() => setLightboxOpen(false)}
            />
          ) : null}
        </AnimatePresence>
      </LayoutGroup>
    )
  }

  if (showImg) {
    return (
      <div className={thumbFrameClass} aria-hidden>
        <img
          src={imgSrc!}
          alt=""
          width={cssPx}
          height={cssPx}
          className={imgClassName}
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
      </div>
    )
  }

  return (
    <span
      className={cn(
        sizeClass,
        'flex shrink-0 items-center justify-center px-0.5 text-[9px] font-bold uppercase leading-tight ring-1',
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
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

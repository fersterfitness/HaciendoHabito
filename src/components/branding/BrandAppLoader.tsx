import { BRAND_LOGO_PATH } from '@/lib/brandLogo'
import { cn } from '@/lib/utils'

type BrandAppLoaderSize = 'md' | 'lg'

const sizeMap: Record<BrandAppLoaderSize, string> = {
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
}

type BrandAppLoaderProps = {
  size?: BrandAppLoaderSize
  className?: string
  /** Pantalla completa centrada (arranque de app / auth). */
  fullScreen?: boolean
}

/** Logo de la marca con animación suave — reemplaza la ruedita en cargas principales. */
export function BrandAppLoader({ size = 'lg', className, fullScreen = false }: BrandAppLoaderProps) {
  const mark = (
    <div
      className={cn('relative flex items-center justify-center', className)}
      role="status"
      aria-label="Cargando"
    >
      <span
        className={cn(
          'absolute rounded-full bg-brand-primary/15 animate-brand-loader-glow',
          size === 'lg' ? 'h-20 w-20' : 'h-14 w-14',
        )}
        aria-hidden
      />
      <img
        src={BRAND_LOGO_PATH}
        alt=""
        width={64}
        height={64}
        draggable={false}
        className={cn(
          sizeMap[size],
          'relative z-[1] select-none object-contain animate-brand-loader-pulse',
          'drop-shadow-[0_4px_14px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)]',
        )}
      />
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base">
        {mark}
      </div>
    )
  }

  return mark
}

import { BRAND_LOGO_PATH } from '@/lib/brandLogo'
import { cn } from '@/lib/utils'

type BrandAppLoaderSize = 'md' | 'lg'

type BrandAppLoaderProps = {
  size?: BrandAppLoaderSize
  className?: string
  /** Pantalla completa centrada (arranque de app / auth): logo quieto + barra. */
  fullScreen?: boolean
}

/**
 * Indicador de carga: barra fina que se desliza (estilo Linear/Notion), sin ruedita ni logo que late.
 * Es el mismo dibujo que la pantalla de arranque de `index.html`, así no hay salto al montar React.
 */
export function BrandAppLoader({ size = 'lg', className, fullScreen = false }: BrandAppLoaderProps) {
  const bar = <span className={cn('hh-loader-bar block h-[3px]', size === 'lg' ? 'w-28' : 'w-20')} aria-hidden />

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-surface-base"
        role="status"
        aria-label="Cargando"
      >
        <img src={BRAND_LOGO_PATH} alt="" width={40} height={40} draggable={false} className="h-10 w-10 select-none object-contain" />
        {bar}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center py-2', className)} role="status" aria-label="Cargando">
      {bar}
    </div>
  )
}

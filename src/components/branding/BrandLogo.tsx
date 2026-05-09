import { cn } from '@/lib/utils'

const logoUrl = '/logo-brand.png'

type BrandLogoSize = 'sm' | 'md' | 'lg'

const box: Record<BrandLogoSize, string> = {
  sm: 'h-[3.25rem] w-[3.25rem]',
  md: 'h-16 w-16',
  /** Login: misma anchura efectiva que `max-w-sm` (columna del formulario), sin desbordar. */
  lg: 'aspect-square mx-auto box-border size-[min(20rem,min(92vw,_48vh))] sm:size-[min(22.5rem,min(100%,42vh))] max-sm:size-[min(19rem,min(94vw,_50svh))]',
}

/** Rail: sombra más marcada + leve elevación en un ícono chico. */
const floatBySize: Record<BrandLogoSize, string> = {
  sm: '-translate-y-px [filter:drop-shadow(0_4px_8px_rgba(0,0,0,0.2))_drop-shadow(0_12px_24px_rgba(0,0,0,0.14))] dark:[filter:drop-shadow(0_5px_12px_rgba(0,0,0,0.55))_drop-shadow(0_16px_32px_rgba(0,0,0,0.32))]',
  md: '-translate-y-px drop-shadow-[0_5px_14px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_8px_22px_rgba(0,0,0,0.38)]',
  lg: '-translate-y-px drop-shadow-[0_5px_14px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_8px_22px_rgba(0,0,0,0.38)]',
}

type BrandLogoProps = {
  size?: BrandLogoSize
  className?: string
  /** En el rail el enlace ya tiene `aria-label`; el mark es decorativo */
  decorative?: boolean
}

/**
 * Marca con transparencia del PNG (`object-contain`). Sombra suave debajo para sensación de flotar.
 */
export function BrandLogo({ size = 'md', className, decorative }: BrandLogoProps) {
  const alt = decorative ? '' : 'Haciéndolo Hábito'
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', box[size], className)}
      {...(decorative ? { 'aria-hidden': true } : {})}
    >
      <img
        src={logoUrl}
        alt={alt}
        width={512}
        height={512}
        draggable={false}
        className={cn(
          'max-h-full max-w-full select-none object-contain object-center',
          size === 'lg' && '-translate-x-[3%]',
          floatBySize[size],
        )}
      />
    </span>
  )
}

import { cn } from '@/lib/utils'

const logoUrl = '/logo-brand.png'

type BrandLogoSize = 'sm' | 'md' | 'lg'

const boxCompact: Record<Exclude<BrandLogoSize, 'lg'>, string> = {
  sm: 'h-[3.25rem] w-[3.25rem]',
  md: 'h-16 w-16',
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
  const wrapperClass =
    size === 'lg'
      ? cn(
          'relative mx-auto box-border flex min-h-0 min-w-0 w-full max-w-full items-center justify-center overflow-visible',
          'aspect-square max-h-[min(24rem,_52svh)]'
        )
      : cn('inline-flex shrink-0 items-center justify-center', boxCompact[size])

  return (
    <span
      className={cn(wrapperClass, className)}
      {...(decorative ? { 'aria-hidden': true } : {})}
    >
      <img
        src={logoUrl}
        alt={alt}
        width={512}
        height={512}
        draggable={false}
        className={cn(
          'max-h-full max-w-full select-none object-contain',
          size === 'lg' ? 'object-[46%_50%]' : 'object-center',
          floatBySize[size],
        )}
      />
    </span>
  )
}

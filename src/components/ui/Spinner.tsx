import { Loader2 } from 'lucide-react'
import { BrandAppLoader } from '@/components/branding/BrandAppLoader'
import { cn } from '@/lib/utils'
import { trainerCtaAccentTextClassName } from '@/lib/primaryGradientCtaClasses'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  fullScreen?: boolean
  /** `role`: sigue `--brand-primary` del tema (nutricionista = verde). `trainerCta`: naranja fijo como CTAs del entrenador. */
  accent?: 'role' | 'trainerCta'
  /**
   * `brand`: logo animado (cargas de app / pantalla).
   * `spin`: ruedita (botones e inline).
   * Por defecto: `lg` o `fullScreen` → brand; `sm`/`md` → spin.
   */
  variant?: 'brand' | 'spin'
}

const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }

export function Spinner({
  size = 'md',
  className,
  fullScreen = false,
  accent = 'role',
  variant,
}: SpinnerProps) {
  const useBrand = variant === 'brand' || (variant !== 'spin' && (size === 'lg' || fullScreen))

  if (useBrand) {
    return (
      <BrandAppLoader
        size={size === 'md' ? 'md' : 'lg'}
        className={className}
        fullScreen={fullScreen}
      />
    )
  }

  const spinner = (
    <Loader2
      className={cn(
        'animate-spin',
        accent === 'trainerCta' ? trainerCtaAccentTextClassName : 'text-brand-primary',
        sizeMap[size],
        className,
      )}
    />
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base">
        {spinner}
      </div>
    )
  }

  return spinner
}

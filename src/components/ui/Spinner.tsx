import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trainerCtaAccentTextClassName } from '@/lib/primaryGradientCtaClasses'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  fullScreen?: boolean
  /** `role`: sigue `--brand-primary` del tema (nutricionista = verde). `trainerCta`: naranja fijo como CTAs del entrenador. */
  accent?: 'role' | 'trainerCta'
}

const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }

export function Spinner({
  size = 'md',
  className,
  fullScreen = false,
  accent = 'role',
}: SpinnerProps) {
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
      <div className="fixed inset-0 bg-surface-base flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}

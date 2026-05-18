import { BrandLogo } from '@/components/branding/BrandLogo'
import { cn } from '@/lib/utils'

type PublicFormBrandBarProps = {
  title: string
  subtitle?: string
  className?: string
  /** En hero oscuro del /form */
  onDark?: boolean
}

/** Cabecera de marca en formularios públicos (intake, check-in). */
export function PublicFormBrandBar({ title, subtitle, className, onDark }: PublicFormBrandBarProps) {
  return (
    <div className={cn('flex items-center gap-3 mb-4', onDark && 'mb-0', className)}>
      <BrandLogo size="sm" decorative className={onDark ? 'drop-shadow-md' : undefined} />
      <div className="min-w-0">
        <p
          className={cn(
            'text-[10px] font-bold uppercase tracking-[0.14em]',
            onDark ? 'text-white/70' : 'text-brand-primary',
          )}
        >
          Ferster Fitness
        </p>
        <h1
          className={cn(
            'text-lg font-bold tracking-tight leading-tight truncate',
            onDark ? 'text-white' : 'text-ink-primary',
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className={cn('text-xs mt-0.5', onDark ? 'text-white/75' : 'text-ink-secondary')}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}

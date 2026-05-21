import type { LucideIcon } from 'lucide-react'
import { Kpi3dIcon, type Kpi3dIconId } from '@/components/icons/kpi3dIcons'
import { cn } from '@/lib/utils'

export type StatIconTone = 'neutral' | 'accent'
export type StatIconVariant = 'flat' | '3d'

const TONE_WRAP: Record<StatIconTone, string> = {
  neutral:
    'border-surface-border/70 bg-gradient-to-b from-surface-elevated/90 to-surface-card text-ink-secondary',
  accent:
    'border-brand-secondary/25 bg-gradient-to-b from-brand-secondary/12 to-surface-card text-brand-secondary',
}

/** Contenedor KPI: PNG 3dicons, Lucide, o relieve CSS en variante `3d`. */
export function StatIcon({
  kpi3dIcon,
  lucideIcon: Lucide,
  tone = 'neutral',
  variant = 'flat',
  className,
  iconClassName,
}: {
  /** Ilustración 3D de 3dicons.co (recomendado en Inicio). */
  kpi3dIcon?: Kpi3dIconId
  lucideIcon?: LucideIcon
  tone?: StatIconTone
  variant?: StatIconVariant
  className?: string
  iconClassName?: string
}) {
  if (kpi3dIcon) {
    return (
      <span
        className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center', className)}
        aria-hidden
      >
        <Kpi3dIcon id={kpi3dIcon} className={iconClassName} size={variant === '3d' ? 40 : 36} />
      </span>
    )
  }

  if (!Lucide) return null

  const is3d = variant === '3d'

  return (
    <span
      className={cn(
        is3d
          ? cn('stat-icon-3d shrink-0', tone === 'accent' && 'stat-icon-3d-accent')
          : cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
              TONE_WRAP[tone],
            ),
        className,
      )}
      aria-hidden
    >
      <Lucide
        className={cn(!is3d && 'h-[18px] w-[18px]', iconClassName)}
        strokeWidth={is3d ? 2 : 1.75}
      />
    </span>
  )
}

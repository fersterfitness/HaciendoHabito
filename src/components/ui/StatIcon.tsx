import type { LucideIcon } from 'lucide-react'
import { Kpi3dIcon, type Kpi3dIconId } from '@/components/icons/kpi3dIcons'
import { cn } from '@/lib/utils'

export type StatIconTone = 'neutral' | 'accent'
export type StatIconVariant = 'flat' | '3d'

const TONE_WRAP: Record<StatIconTone, string> = {
  neutral:
    'border-transparent bg-surface-elevated text-ink-secondary',
  accent:
    'border-transparent bg-brand-secondary/10 text-brand-secondary',
}

/** Contenedor KPI: icono Animate UI, Lucide, o relieve CSS en variante `3d`. */
export function StatIcon({
  kpi3dIcon,
  lucideIcon: Lucide,
  tone = 'neutral',
  variant = 'flat',
  className,
  iconClassName,
}: {
  /** Icono KPI animado (Animate UI / Lucide). */
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
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
          tone === 'accent'
            ? 'border-brand-secondary/18 bg-brand-secondary/6 text-brand-secondary/65'
            : 'border-surface-border/55 bg-surface-elevated/45 text-ink-secondary/65',
          className,
        )}
        aria-hidden
      >
        <Kpi3dIcon
          id={kpi3dIcon}
          className={cn('opacity-90', iconClassName)}
          size={17}
          strokeWidth={1.5}
        />
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

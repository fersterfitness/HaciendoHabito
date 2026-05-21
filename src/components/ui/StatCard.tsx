import { type ReactNode, useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, Plus } from 'lucide-react'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { Kpi3dIconId } from '@/components/icons/kpi3dIcons'
import { Kpi3dIcon } from '@/components/icons/kpi3dIcons'
import { StatIcon, type StatIconTone, type StatIconVariant } from '@/components/ui/StatIcon'

/** @deprecated Usar `kpi3dIcon`. */
export type KpiFigmaIconId = Kpi3dIconId

export type StatCardSurface = 'default' | 'gradient'

export interface StatCardAction {
  ariaLabel: string
  onClick: () => void
}

export type StatCardTone = 'neutral' | 'success' | 'warning' | 'info'

const TONE_CARD: Record<StatCardTone, string> = {
  neutral: 'border-surface-border/80 bg-surface-card',
  success: 'border-status-generated/25 bg-status-generated/5',
  warning: 'border-status-expiring/30 bg-status-expiring/5',
  info: 'border-status-sent/25 bg-status-sent/5',
}

const TONE_TO_ICON: Record<StatCardTone, StatIconTone> = {
  neutral: 'neutral',
  success: 'neutral',
  warning: 'neutral',
  info: 'neutral',
}

interface StatCardProps {
  title: string
  value: string | number
  countUp?: boolean
  subtitle?: string
  icon?: ReactNode
  lucideIcon?: LucideIcon
  kpi3dIcon?: Kpi3dIconId
  kpiFigmaIcon?: Kpi3dIconId
  tone?: StatCardTone
  compact?: boolean
  /** Más brillo en el degradado secondary (p. ej. ingresos). */
  featured?: boolean
  /** `gradient` = fondo violeta suave + título secondary (Inicio). */
  surface?: StatCardSurface
  iconVariant?: StatIconVariant
  monthOverMonth?: { thisMonth: number; prevMonth: number; scopeLabel?: string }
  action?: StatCardAction
  onClick?: () => void
  className?: string
}

function ComparisonFooter({
  comparison,
  monthOverMonth,
}: {
  comparison: { delta: number; pct: number | null; scopeLabel?: string }
  monthOverMonth: { thisMonth: number; prevMonth: number; scopeLabel?: string }
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-baseline gap-x-1 gap-y-0.5 min-w-0 leading-snug',
        'text-[10px] sm:text-[11px] font-medium tabular-nums',
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-semibold',
          comparison.delta > 0 && 'text-status-generated',
          comparison.delta < 0 && 'text-status-expired',
          comparison.delta === 0 && 'text-ink-muted',
        )}
      >
        {comparison.delta > 0 ? (
          <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
        ) : comparison.delta < 0 ? (
          <ArrowDownRight className="h-3 w-3 shrink-0" aria-hidden />
        ) : null}
        {comparison.delta === 0
          ? '0'
          : `${comparison.delta > 0 ? '+' : ''}${comparison.delta}`}
        {comparison.pct !== null && (
          <span className="opacity-90">
            {' '}
            ({comparison.pct >= 0 ? '+' : ''}
            {comparison.pct}%)
          </span>
        )}
        {comparison.pct === null &&
          comparison.delta > 0 &&
          monthOverMonth.prevMonth === 0 && <span className="opacity-90"> (nuevo)</span>}
      </span>
      <span className="text-ink-muted">
        · {comparison.scopeLabel ? `${comparison.scopeLabel} ` : ''}vs mes anterior
      </span>
    </div>
  )
}

function GradientIconPod({
  kpiId,
  lucideIcon,
  icon,
  iconVariant,
  compact,
}: {
  kpiId?: Kpi3dIconId
  lucideIcon?: LucideIcon
  icon?: ReactNode
  iconVariant: StatIconVariant
  compact: boolean
}) {
  const podClass = cn(
    'flex shrink-0 items-center justify-center rounded-2xl border',
    'border-brand-secondary/25 bg-brand-secondary/12',
    compact ? 'h-9 w-9' : 'h-10 w-10',
  )

  if (kpiId) {
    return (
      <div className={podClass}>
        <Kpi3dIcon id={kpiId} size={compact ? 30 : 32} />
      </div>
    )
  }

  if (lucideIcon) {
    const Lucide = lucideIcon
    return (
      <div className={podClass}>
        <Lucide className="h-5 w-5 text-brand-secondary" strokeWidth={1.75} />
      </div>
    )
  }

  if (icon) {
    return <div className={cn(podClass, 'text-brand-secondary [&_svg]:h-5 [&_svg]:w-5')}>{icon}</div>
  }

  return null
}

/** Tarjeta KPI estilo Inicio: degradado brand-secondary. */
function StatCardGradient({
  title,
  displayValue,
  footerLine,
  kpi3dIcon,
  kpiFigmaIcon,
  lucideIcon,
  icon,
  iconVariant,
  compact,
  featured,
  action,
  onClick,
  className,
}: {
  title: string
  displayValue: string | number
  footerLine: ReactNode
  kpi3dIcon?: Kpi3dIconId
  kpiFigmaIcon?: Kpi3dIconId
  lucideIcon?: LucideIcon
  icon?: ReactNode
  iconVariant: StatIconVariant
  compact: boolean
  featured: boolean
  action?: StatCardAction
  onClick?: () => void
  className?: string
}) {
  const kpiId = kpi3dIcon ?? kpiFigmaIcon

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'relative overflow-hidden rounded-2xl border flex flex-col',
        compact ? 'min-h-0 p-2.5' : 'min-h-0 p-3',
        featured
          ? 'border-brand-secondary/35 bg-gradient-to-br from-brand-secondary/22 via-surface-card to-surface-card shadow-[0_8px_28px_rgba(169,121,255,0.08)]'
          : 'border-brand-secondary/25 bg-gradient-to-br from-brand-secondary/14 via-surface-card to-surface-card',
        onClick &&
          'cursor-pointer hover:border-brand-secondary/45 hover:shadow-md hover:shadow-brand-secondary/10 transition-all duration-200',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute rounded-full bg-brand-secondary/20 blur-2xl',
          featured ? '-right-5 -top-5 h-20 w-20' : '-right-6 -top-6 h-16 w-16 opacity-80',
        )}
        aria-hidden
      />

      <div className="relative flex items-center gap-2">
        <GradientIconPod
          kpiId={kpiId}
          lucideIcon={lucideIcon}
          icon={icon}
          iconVariant={iconVariant}
          compact={compact}
        />
        <p
          className={cn(
            'min-w-0 flex-1 font-semibold uppercase tracking-wider leading-snug',
            'text-brand-secondary/90 dark:text-brand-secondary/95',
            compact ? 'text-[9px] line-clamp-2' : 'text-[10px] sm:text-label line-clamp-2',
          )}
        >
          {title}
        </p>
        {action && (
          <button
            type="button"
            aria-label={action.ariaLabel}
            onClick={(e) => {
              e.stopPropagation()
              action.onClick()
            }}
            className="relative z-10 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-secondary/30 bg-surface-card/60 text-ink-secondary hover:bg-brand-secondary/15 transition-colors"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}
      </div>

      <p
        className={cn(
          'relative mt-1.5 font-semibold text-ink-primary tabular-nums leading-none tracking-tight',
          compact ? 'text-lg' : 'text-[22px] sm:text-2xl',
        )}
      >
        {displayValue}
      </p>

      {footerLine ? <div className="relative mt-1.5 pt-0.5">{footerLine}</div> : null}
    </div>
  )
}

export function StatCard({
  title,
  value,
  countUp = false,
  subtitle,
  icon,
  lucideIcon,
  kpi3dIcon,
  kpiFigmaIcon,
  tone = 'neutral',
  compact = false,
  featured = false,
  surface = 'default',
  iconVariant = 'flat',
  monthOverMonth,
  action,
  onClick,
  className,
}: StatCardProps) {
  const numericTarget = typeof value === 'number' ? value : 0
  const animated = useCountUp(numericTarget, {
    duration: 2200,
    enabled: countUp && typeof value === 'number',
  })
  const displayValue = countUp && typeof value === 'number' ? animated : value

  const comparison = useMemo(() => {
    if (!monthOverMonth) return null
    const { thisMonth: t, prevMonth: p, scopeLabel } = monthOverMonth
    const delta = t - p
    const pct = p > 0 ? Math.round((delta / p) * 100) : null
    return { delta, pct, scopeLabel }
  }, [monthOverMonth])

  const footerLine =
    comparison != null && monthOverMonth ? (
      <ComparisonFooter comparison={comparison} monthOverMonth={monthOverMonth} />
    ) : subtitle ? (
      <p className="text-[10px] sm:text-[11px] font-medium text-ink-muted leading-snug">{subtitle}</p>
    ) : null

  const useGradient = surface === 'gradient' || featured

  if (useGradient && !compact) {
    return (
      <StatCardGradient
        title={title}
        displayValue={displayValue}
        footerLine={footerLine}
        kpi3dIcon={kpi3dIcon}
        kpiFigmaIcon={kpiFigmaIcon}
        lucideIcon={lucideIcon}
        icon={icon}
        iconVariant={iconVariant}
        compact={compact}
        featured={featured}
        action={action}
        onClick={onClick}
        className={className}
      />
    )
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'rounded-2xl border shadow-card flex flex-col gap-2',
        compact ? 'min-h-0 p-2.5' : 'min-h-0 p-3',
        TONE_CARD[tone],
        onClick &&
          'cursor-pointer hover:border-surface-border hover:bg-surface-elevated/35 transition-colors duration-200',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {(kpi3dIcon || kpiFigmaIcon || lucideIcon || icon) && (
          <StatIcon
            kpi3dIcon={kpi3dIcon ?? kpiFigmaIcon}
            lucideIcon={lucideIcon}
            tone={TONE_TO_ICON[tone]}
            variant={iconVariant}
            className={compact ? 'scale-90' : undefined}
          />
        )}
        <p className="min-w-0 flex-1 text-label font-semibold uppercase tracking-wider text-ink-muted truncate">
          {title}
        </p>
        {action && (
          <button
            type="button"
            aria-label={action.ariaLabel}
            onClick={(e) => {
              e.stopPropagation()
              action.onClick()
            }}
            className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-surface-border text-ink-secondary hover:bg-surface-elevated"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        )}
      </div>

      <p
        className={cn(
          'font-semibold text-ink-primary tabular-nums leading-none',
          compact ? 'text-xl' : 'text-2xl',
        )}
      >
        {displayValue}
      </p>

      {footerLine ? <div className="mt-auto pt-1">{footerLine}</div> : null}
    </div>
  )
}

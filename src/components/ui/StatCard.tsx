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

/** Títulos KPI con degradado (Resumen del mes, Inicio). */
export const statCardGradientTitleClass =
  'font-semibold uppercase tracking-wider leading-snug text-ink-muted'

/** Borde suave + sombra flotante (KPI / resumen del mes). */
const statCardFloatClass = cn(
  'border-surface-border/40 bg-surface-card',
  'shadow-[0_2px_8px_-2px_rgba(15,15,35,0.07),0_10px_28px_-8px_rgba(15,15,35,0.11)]',
  'dark:border-white/[0.07]',
  'dark:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.42),0_12px_36px_-10px_rgba(0,0,0,0.55)]',
)

const TONE_CARD: Record<StatCardTone, string> = {
  neutral: statCardFloatClass,
  success: cn(
    statCardFloatClass,
    'border-status-generated/20 bg-status-generated/5',
  ),
  warning: cn(
    statCardFloatClass,
    'border-status-expiring/25 bg-status-expiring/5',
  ),
  info: cn(statCardFloatClass, 'border-status-sent/20 bg-status-sent/5'),
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
  /** Variación % MoM (misma fila de footer que `monthOverMonth`, p. ej. ingresos). */
  comparisonPercent?: number
  action?: StatCardAction
  onClick?: () => void
  className?: string
  /** Avatar 3D sobresaliente (prueba visual; ej. personaje en tarjeta de alumnos). */
  heroAvatarSrc?: string
}

/** Altura fija del footer de comparación (evita saltos entre cards). */
const GRADIENT_FOOTER_MIN_H = 'min-h-[1.125rem]'

/** Popover “vs mes anterior” arriba de la métrica; no altera el layout de la card. */
function VsMesAnteriorHint() {
  return (
    <span
      role="note"
      aria-hidden
      className={cn(
        'pointer-events-none absolute bottom-full left-0 z-20 mb-0.5 whitespace-nowrap',
        'rounded border border-surface-border/70 bg-surface-card px-1.5 py-px',
        'text-[9px] font-medium leading-none text-ink-muted shadow-sm',
        'opacity-0 transition-opacity duration-150',
        'group-hover:opacity-100 group-focus-within:opacity-100',
      )}
    >
      vs mes anterior
    </span>
  )
}

function ComparisonFooter({
  comparison,
  monthOverMonth,
}: {
  comparison: { delta: number; pct: number | null; scopeLabel?: string }
  monthOverMonth: { thisMonth: number; prevMonth: number; scopeLabel?: string }
}) {
  return (
    <div className="relative min-w-0">
      <VsMesAnteriorHint />
      <div
        className={cn(
          'flex min-w-0 items-baseline leading-snug',
          'text-[10px] sm:text-[11px] font-medium tabular-nums',
        )}
      >
        <span
          className={cn(
            'inline-flex items-center gap-0.5 font-semibold shrink-0',
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
          {comparison.pct === null &&
            comparison.delta > 0 &&
            monthOverMonth.prevMonth === 0 && <span className="opacity-90"> (nuevo)</span>}
        </span>
      </div>
    </div>
  )
}

function PercentComparisonFooter({ percent, featured = false }: { percent: number; featured?: boolean }) {
  return (
    <div className="relative min-w-0">
      <VsMesAnteriorHint />
      <div
        className={cn(
          'flex min-w-0 items-baseline leading-snug',
          'text-[10px] sm:text-[11px] font-medium tabular-nums',
        )}
      >
        <span
          className={cn(
            'inline-flex items-center gap-0.5 font-semibold shrink-0',
            featured
              ? 'text-white/90'
              : cn(
                  percent > 0 && 'text-status-generated',
                  percent < 0 && 'text-status-expired',
                  percent === 0 && 'text-ink-muted',
                ),
          )}
        >
          {percent > 0 ? (
            <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
          ) : percent < 0 ? (
            <ArrowDownRight className="h-3 w-3 shrink-0" aria-hidden />
          ) : null}
          {percent === 0 ? '0%' : `${percent > 0 ? '+' : ''}${percent}%`}
        </span>
      </div>
    </div>
  )
}

/** Altura fija del valor principal (evita saltos entre número corto y monto largo). */
const GRADIENT_VALUE_MIN_H = 'min-h-[1.75rem]'

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
    'flex shrink-0 items-center justify-center rounded-xl border',
    'border-brand-secondary/18 bg-brand-secondary/6',
    compact ? 'h-8 w-8' : 'h-8 w-8',
  )

  if (kpiId) {
    return (
      <div className={podClass}>
        <Kpi3dIcon
          id={kpiId}
          size={compact ? 16 : 17}
          strokeWidth={1.5}
          className="text-brand-secondary/65 opacity-90"
        />
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

/**
 * Avatar 3D estilo "pop-out": anclado al fondo y dimensionado para que la
 * cabeza sobresalga POR ARRIBA del borde superior (efecto Omen / TOP AGENT).
 * Requiere overflow-visible en los padres (ya garantizado por StatCardHeroFrame
 * y por el grid contenedor).
 */
function StatCardHeroOverlay({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn(
        'pointer-events-none absolute z-30 block h-auto w-auto bg-transparent',
        // Render con el cuerpo del personaje (~72% canvas) sobresaliendo por arriba.
        // Tamaño moderado: pop-out visible pero sin dominar la card.
        'right-0 bottom-0 h-[10rem] max-w-[52%] sm:h-[11rem] sm:max-w-[46%]',
        'object-contain object-bottom',
        // Sombra realista para que se perciba delante (no dentro) de la card.
        '[filter:drop-shadow(0_3px_6px_rgba(0,0,0,0.4))_drop-shadow(0_14px_24px_rgba(0,0,0,0.32))]',
        'motion-safe:transition-transform motion-safe:duration-300',
      )}
    />
  )
}

function StatCardHeroFrame({
  heroAvatarSrc,
  children,
}: {
  heroAvatarSrc: string
  children: ReactNode
}) {
  return (
    <div className="relative h-full overflow-visible">
      {children}
      <StatCardHeroOverlay src={heroAvatarSrc} />
    </div>
  )
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
  heroAvatarSrc,
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
  heroAvatarSrc?: string
}) {
  const kpiId = kpi3dIcon ?? kpiFigmaIcon
  const showHero = Boolean(heroAvatarSrc?.trim())

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
        'group relative flex h-full flex-col rounded-2xl border',
        statCardFloatClass,
        showHero || footerLine ? 'overflow-visible' : 'overflow-hidden',
        compact ? 'min-h-0 p-2.5' : 'min-h-0 p-3',
        showHero && !compact && 'pr-[36%] sm:pr-[32%]',
        featured
          ? 'border-orange-500 bg-gradient-to-br from-orange-500 via-orange-500 to-fuchsia-500'
          : 'bg-gradient-to-br from-brand-secondary/9 via-surface-card to-surface-card',
        onClick &&
          'cursor-pointer transition-all duration-200 hover:border-surface-border/55 hover:shadow-[0_4px_14px_-2px_rgba(15,15,35,0.1),0_14px_32px_-8px_rgba(15,15,35,0.14)] dark:hover:border-white/[0.1]',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute rounded-full blur-2xl',
          featured
            ? 'bg-white/25 -right-5 -top-5 h-24 w-24'
            : 'bg-brand-secondary/20 -right-6 -top-6 h-16 w-16 opacity-80',
        )}
        aria-hidden
      />

      <div className={cn('relative z-10 flex items-center gap-2', showHero && 'max-w-full')}>
        {!showHero ? (
          <GradientIconPod
            kpiId={kpiId}
            lucideIcon={lucideIcon}
            icon={icon}
            iconVariant={iconVariant}
            compact={compact}
          />
        ) : null}
        <p
          className={cn(
            'min-w-0 flex-1 line-clamp-2',
            statCardGradientTitleClass,
            compact ? 'text-[9px]' : 'text-[10px] sm:text-[0.6875rem]',
            featured && 'text-white/90',
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
          'relative mt-1.5 font-semibold tabular-nums leading-none tracking-tight',
          featured ? 'text-white' : 'text-ink-primary',
          compact ? 'text-lg' : 'text-[22px] sm:text-2xl',
          !compact && GRADIENT_VALUE_MIN_H,
          !compact &&
            typeof displayValue === 'string' &&
            'whitespace-nowrap overflow-hidden text-ellipsis max-w-full',
        )}
      >
        {displayValue}
      </p>

      {footerLine ? (
        <div className={cn('relative mt-auto pt-1.5', !compact && GRADIENT_FOOTER_MIN_H)}>
          {footerLine}
        </div>
      ) : null}
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
  comparisonPercent,
  action,
  onClick,
  className,
  heroAvatarSrc,
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
    comparisonPercent !== undefined ? (
      <PercentComparisonFooter percent={comparisonPercent} featured={featured} />
    ) : comparison != null && monthOverMonth ? (
      <ComparisonFooter comparison={comparison} monthOverMonth={monthOverMonth} />
    ) : subtitle ? (
      <p className="text-[10px] sm:text-[11px] font-medium text-ink-muted leading-snug">{subtitle}</p>
    ) : null

  const useGradient = surface === 'gradient' || featured

  if (useGradient && !compact) {
    const heroSrc = heroAvatarSrc?.trim()
    const gradientCard = (
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
        heroAvatarSrc={heroSrc}
      />
    )
    if (heroSrc) {
      return (
        <div className="group relative z-[1] h-full overflow-visible hover:z-[2]">
          <StatCardHeroFrame heroAvatarSrc={heroSrc}>{gradientCard}</StatCardHeroFrame>
        </div>
      )
    }
    return <div className="h-full">{gradientCard}</div>
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
        'flex flex-col gap-2 rounded-2xl border',
        compact ? 'min-h-0 p-2.5' : 'min-h-0 p-3',
        TONE_CARD[tone],
        onClick &&
          'cursor-pointer transition-all duration-200 hover:border-surface-border/55 hover:bg-surface-elevated/30',
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

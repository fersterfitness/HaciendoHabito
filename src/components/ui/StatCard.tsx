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
  /** Variación % MoM (misma fila de footer que `monthOverMonth`, p. ej. ingresos). */
  comparisonPercent?: number
  action?: StatCardAction
  onClick?: () => void
  className?: string
  /** Avatar 3D sobresaliente (prueba visual; ej. personaje en tarjeta de alumnos). */
  heroAvatarSrc?: string
}

function ComparisonFooter({
  comparison,
  monthOverMonth,
}: {
  comparison: { delta: number; pct: number | null; scopeLabel?: string }
  monthOverMonth: { thisMonth: number; prevMonth: number; scopeLabel?: string }
}) {
  // Single line: "↗ +2 vs mes anterior". El scopeLabel se omite a propósito —
  // el título de la card ya da contexto y mantener todo en una línea unifica
  // la altura de todas las cards del grid.
  return (
    <div
      className={cn(
        'flex items-baseline gap-1.5 min-w-0 leading-snug',
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
      <span className="text-ink-muted truncate">vs mes anterior</span>
    </div>
  )
}

function PercentComparisonFooter({ percent }: { percent: number }) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-1.5 min-w-0 leading-snug',
        'text-[10px] sm:text-[11px] font-medium tabular-nums',
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-semibold shrink-0',
          percent > 0 && 'text-status-generated',
          percent < 0 && 'text-status-expired',
          percent === 0 && 'text-ink-muted',
        )}
      >
        {percent > 0 ? (
          <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
        ) : percent < 0 ? (
          <ArrowDownRight className="h-3 w-3 shrink-0" aria-hidden />
        ) : null}
        {percent === 0 ? '0%' : `${percent > 0 ? '+' : ''}${percent}%`}
      </span>
      <span className="text-ink-muted truncate">vs mes anterior</span>
    </div>
  )
}

/** Altura fija del bloque de título (2 líneas máx.) para alinear cards del grid. */
const GRADIENT_TITLE_MIN_H = 'min-h-[2.5rem]'
/** Altura fija del valor principal (evita saltos entre número corto y monto largo). */
const GRADIENT_VALUE_MIN_H = 'min-h-[1.75rem]'
/** Altura fija del footer de comparación. */
const GRADIENT_FOOTER_MIN_H = 'min-h-[1.125rem]'

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
        'relative rounded-2xl border flex h-full flex-col',
        showHero ? 'overflow-visible' : 'overflow-hidden',
        compact ? 'min-h-0 p-2.5' : 'min-h-0 p-3',
        showHero && !compact && 'pr-[36%] sm:pr-[32%]',
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
          !compact && GRADIENT_VALUE_MIN_H,
          !compact &&
            typeof displayValue === 'string' &&
            'whitespace-nowrap overflow-hidden text-ellipsis max-w-full',
        )}
      >
        {displayValue}
      </p>

      <div
        className={cn(
          'relative mt-auto pt-1.5',
          !compact && GRADIENT_FOOTER_MIN_H,
          !footerLine && !compact && 'invisible',
        )}
        aria-hidden={!footerLine}
      >
        {footerLine ?? <span className="text-[10px] sm:text-[11px]">vs mes anterior</span>}
      </div>
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
      <PercentComparisonFooter percent={comparisonPercent} />
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
        <div className="relative z-[1] h-full overflow-visible hover:z-[2]">
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

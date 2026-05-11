import { type ReactNode, useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, Plus } from 'lucide-react'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/utils'

export interface StatCardAction {
  ariaLabel: string
  onClick: () => void
}

interface StatCardProps {
  title: string
  value: string | number
  /** Si es true y `value` es número, cuenta desde 0 al montar (p. ej. Inicio). */
  countUp?: boolean
  subtitle?: string
  icon: ReactNode
  /** Conteos del mes actual y del anterior (delta positivo = verde, negativo = rojo). Suele medir un flujo distinto del número principal. */
  monthOverMonth?: { thisMonth: number; prevMonth: number; scopeLabel?: string }
  /** Botón destacado pequeño (p. ej. alta rápida de alumno). */
  action?: StatCardAction
  onClick?: () => void
  className?: string
}

export function StatCard({
  title,
  value,
  countUp = false,
  subtitle,
  icon,
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
        'rounded-xl border border-surface-border/80 bg-surface-card p-4',
        'flex flex-col gap-3 min-h-[128px]',
        onClick &&
          'cursor-pointer hover:border-surface-border hover:bg-surface-elevated/40 transition-colors duration-200',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-ink-muted shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
          <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider truncate">
            {title}
          </p>
        </div>
        {action && (
          <button
            type="button"
            aria-label={action.ariaLabel}
            onClick={(e) => {
              e.stopPropagation()
              action.onClick()
            }}
            className={cn(
              'shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg',
              'border border-surface-border text-ink-secondary',
              'hover:bg-surface-elevated hover:text-ink-primary transition-colors'
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}
      </div>

      <p className="text-[32px] font-semibold text-ink-primary tabular-nums leading-none tracking-tight">
        {displayValue}
      </p>

      {subtitle && (
        <p className="text-[11px] text-ink-secondary -mt-1">{subtitle}</p>
      )}

      {comparison && (
        <div
          className={cn(
            'mt-auto pt-0.5 flex flex-nowrap items-center gap-0.5 min-w-0',
            'text-[10px] sm:text-[11px] font-semibold tabular-nums leading-none',
            comparison.delta > 0 && 'text-status-generated',
            comparison.delta < 0 && 'text-status-expired',
            comparison.delta === 0 && 'text-ink-muted'
          )}
        >
          {comparison.delta > 0 ? (
            <ArrowUpRight className="h-3 w-3 shrink-0 self-center" aria-hidden />
          ) : comparison.delta < 0 ? (
            <ArrowDownRight className="h-3 w-3 shrink-0 self-center" aria-hidden />
          ) : null}
          <span className="min-w-0 truncate">
            {comparison.delta === 0
              ? '0'
              : `${comparison.delta > 0 ? '+' : ''}${comparison.delta}`}
            {comparison.pct !== null &&
              ` (${comparison.pct >= 0 ? '+' : ''}${comparison.pct}%)`}
            {comparison.pct === null &&
              comparison.delta > 0 &&
              monthOverMonth &&
              monthOverMonth.prevMonth === 0 &&
              ' (nuevo)'}
            <span className="font-medium text-ink-muted">
              {' · '}
              {comparison.scopeLabel ? `${comparison.scopeLabel} ` : ''}
              vs mes anterior
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

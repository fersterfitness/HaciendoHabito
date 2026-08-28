import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RoutineWeekSquaresProps = {
  totalWeeks: number
  currentWeek: number | null
  finished: boolean
  lastWeek?: boolean
  className?: string
}

/** Cuadraditos de semana (misma lectura que Seguimiento). */
export function RoutineWeekSquares({
  totalWeeks,
  currentWeek,
  finished,
  lastWeek = false,
  className,
}: RoutineWeekSquaresProps) {
  if (totalWeeks <= 0) {
    return <span className={cn('text-[11px] text-ink-muted', className)}>—</span>
  }
  const effectiveWeek = finished
    ? totalWeeks
    : currentWeek ?? (lastWeek ? totalWeeks : null)
  return (
    <div
      className={cn('inline-flex flex-wrap items-center gap-0.5', lastWeek && 'text-rose-600 dark:text-rose-400', className)}
      aria-label={
        lastWeek
          ? 'Última semana · renovar rutina'
          : finished
            ? 'Mes de rutina cerrado'
            : currentWeek
              ? `Semana ${currentWeek} de ${totalWeeks}`
              : `${totalWeeks} semanas · sin check-in`
      }
    >
      {Array.from({ length: totalWeeks }, (_, i) => {
        const n = i + 1
        const done = finished || (effectiveWeek != null && n <= effectiveWeek)
        const current = !finished && effectiveWeek === n
        return (
          <span
            key={n}
            title={`Semana ${n}`}
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded px-0.5 text-[8px] font-bold tabular-nums',
              done
                ? lastWeek
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-surface-elevated text-ink-muted',
              current && (lastWeek ? 'ring-1 ring-rose-500/60' : 'ring-1 ring-brand-primary/50'),
            )}
          >
            {done ? <Check className="h-2.5 w-2.5" strokeWidth={2.6} /> : n}
          </span>
        )
      })}
      {lastWeek ? (
        <span className="ml-0.5 text-[8px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
          Última
        </span>
      ) : null}
    </div>
  )
}

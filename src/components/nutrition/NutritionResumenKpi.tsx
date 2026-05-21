import { type ReactNode, useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import { cn } from '@/lib/utils'

export interface NutritionKpiProps {
  label: string
  icon: ReactNode
  value: number | null
  previous: number | null
  unit?: string
  /** What direction is an "improvement" for this metric. Used to color the delta. */
  desiredDirection?: 'down' | 'up' | 'neutral'
  /** Last N values, oldest-first, for the sparkline. */
  series?: Array<number | null>
  /** Number of decimals for the rendered value (default 1). */
  precision?: number
}

function fmt(value: number | null, precision: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(precision).replace(/\.0+$/, (s) => (precision === 0 ? '' : s))
}

export function NutritionResumenKpi({
  label,
  icon,
  value,
  previous,
  unit,
  desiredDirection: _desiredDirection = 'neutral',
  series,
  precision = 1,
}: NutritionKpiProps) {
  const delta = value != null && previous != null ? value - previous : null
  const pct = delta != null && previous && previous !== 0 ? (delta / previous) * 100 : null

  const sparkData = useMemo(() => {
    if (!series || series.length < 2) return null
    const cleaned = series.map((v, i) => ({ i, v }))
    const hasAny = cleaned.some((p) => p.v != null && Number.isFinite(p.v))
    if (!hasAny) return null
    return cleaned
  }, [series])

  const tone = 'text-ink-muted'

  const sparkStroke = 'rgb(var(--ink-muted) / 0.55)'

  return (
    <div className="rounded-2xl border border-surface-border/80 bg-surface-card p-4 flex flex-col gap-3 min-h-[150px]">
      <div className="flex items-center gap-2">
        <span className="text-ink-muted shrink-0 [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider truncate">
          {label}
        </p>
      </div>

      <div className="flex items-baseline gap-1.5">
        <p className="text-[28px] font-semibold text-ink-primary tabular-nums leading-none tracking-tight">
          {fmt(value, precision)}
        </p>
        {value != null && unit ? <span className="text-sm text-ink-muted">{unit}</span> : null}
      </div>

      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className={cn('flex items-center gap-1 text-[11px] font-semibold tabular-nums leading-none', tone)}>
          {delta == null ? (
            <span className="text-ink-muted">Sin control previo</span>
          ) : delta > 0 ? (
            <>
              <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
              <span>
                +{fmt(delta, precision)}
                {unit ? ` ${unit}` : ''}
                {pct != null ? ` · +${pct.toFixed(1)}%` : ''}
              </span>
            </>
          ) : delta < 0 ? (
            <>
              <ArrowDownRight className="h-3 w-3 shrink-0" aria-hidden />
              <span>
                {fmt(delta, precision)}
                {unit ? ` ${unit}` : ''}
                {pct != null ? ` · ${pct.toFixed(1)}%` : ''}
              </span>
            </>
          ) : (
            <>
              <Minus className="h-3 w-3 shrink-0" aria-hidden />
              <span>Sin cambios</span>
            </>
          )}
        </div>

        {sparkData ? (
          <div className="w-20 h-8 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <YAxis hide domain={['auto', 'auto']} />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparkStroke}
                  strokeWidth={1.75}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </div>
  )
}

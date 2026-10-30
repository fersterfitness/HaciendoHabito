import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { chartActiveDot, chartAxis, chartCursor, chartGrid, compactCurrency } from '@/components/charts/chartKit'
import { cn, formatCurrency } from '@/lib/utils'
import { financeUi } from '@/lib/uiGlossary'
import { type ExpenseSeriesMeta, type ScopeMonthDetail, type ExpenseChartModel } from './dashboardShared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExpenseScopesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const raw = payload[0].payload as Record<string, unknown>
  const series = (raw.__series as ExpenseSeriesMeta[]) ?? []
  const detail = (raw.__detail as Record<string, ScopeMonthDetail>) ?? {}

  return (
    <div className="max-w-[260px] rounded-xl border border-surface-border bg-surface-card/95 px-3 py-2 text-xs shadow-pop backdrop-blur">
      <p className="font-semibold text-ink-primary">{label}</p>
      <div className="mt-1.5 space-y-2">
        {series.map((s) => {
          const d = detail[s.key] ?? { cobrados: 0, gastos: 0 }
          const net = Number(raw[s.key] ?? 0)
          return (
            <div key={s.key} className="border-b border-surface-border/50 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate font-medium text-ink-secondary">{s.label}</span>
                </span>
                <span className={cn(
                  'shrink-0 text-xs font-bold tabular-nums',
                  net >= 0 ? 'text-status-generated' : 'text-status-expired',
                )}
                >
                  {formatCurrency(net)}
                </span>
              </div>
              <p className="mt-1 pl-3 text-3xs leading-snug text-ink-muted tabular-nums">
                {financeUi.cobrado} ${d.cobrados.toLocaleString('es-AR')} · {financeUi.gastos} ${d.gastos.toLocaleString('es-AR')}
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-2 border-t border-surface-border pt-2 text-2xs font-semibold tabular-nums text-ink-primary">
        {financeUi.netosSum}: {formatCurrency(Number(raw.combinedNetSum ?? 0))}
      </p>
      {(() => {
        const idx = Number(raw.__monthIndex ?? 0)
        const pct = Number(raw.changePctCombinedNet ?? 0)
        if (idx === 0) {
          return (
            <p className="mt-1.5 text-3xs leading-snug text-ink-muted">
              Primer mes del rango: sin comparación vs mes anterior.
            </p>
          )
        }
        return (
          <p
            className={cn(
              'mt-1.5 border-t border-surface-border pt-1.5 text-3xs font-medium tabular-nums',
              pct > 0 && 'text-status-generated',
              pct < 0 && 'text-status-expired',
              pct === 0 && 'text-ink-muted',
            )}
          >
            Σ netos vs mes anterior: {pct > 0 ? '+' : ''}
            {pct === 0 ? '0%' : `${pct}%`}
          </p>
        )
      })()}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomXTick({ x, y, payload }: any) {
  const d = payload.value as string
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={10} fill="rgb(var(--ink-muted))" fontWeight={600}>
      {d}
    </text>
  )
}

function expenseChartRechartsData(model: ExpenseChartModel) {
  return model.months.map((m, i) => {
    const row: Record<string, unknown> = {
      label: m.label,
      combinedNetSum: m.combinedNetSum,
      changePctCombinedNet: m.changePctCombinedNet,
      __monthIndex: i,
      __series: model.series,
      __detail: m.detail,
    }
    for (const { key } of model.series) row[key] = m.values[key] ?? 0
    return row
  })
}

export function ExpenseScopesLineChart({ model }: { model: ExpenseChartModel }) {
  const data = expenseChartRechartsData(model)
  const hasNegative = data.some((row) => model.series.some((s) => Number(row[s.key] ?? 0) < 0))
  return (
    <div className="w-full px-1 pb-2">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}>
          <defs>
            {model.series.map((s) => (
              <linearGradient key={s.key} id={`scope-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="label" tick={<CustomXTick />} axisLine={false} tickLine={false} height={24} />
          <YAxis
            {...chartAxis}
            tickFormatter={(v: number) => (v === 0 ? '' : compactCurrency(v))}
            width={52}
          />
          {hasNegative ? <ReferenceLine y={0} stroke="rgb(var(--ink-muted))" strokeOpacity={0.35} /> : null}
          <RechartsTooltip content={<ExpenseScopesTooltip />} cursor={chartCursor} />
          {model.series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.25}
              fill={`url(#scope-fill-${s.key})`}
              dot={false}
              activeDot={chartActiveDot(s.color)}
              isAnimationActive
              animationDuration={700}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

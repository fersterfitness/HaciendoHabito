import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Kit visual común para Recharts: misma grilla, ejes, tooltip y degradés en todos los gráficos.
 * Uso: <CartesianGrid {...chartGrid} />, <XAxis {...chartAxis} />, <Tooltip content={<ChartTooltip />} cursor={chartCursor} />.
 */

/** Grilla horizontal sutil, sin verticales. */
export const chartGrid = {
  vertical: false,
  stroke: 'rgb(var(--surface-border))',
  strokeDasharray: '3 5',
  strokeOpacity: 0.9,
} as const

/** Ejes livianos: sin líneas, texto chico en tono apagado. */
export const chartAxis = {
  tick: { fontSize: 10, fill: 'rgb(var(--ink-muted))' },
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const

/** Cursor de líneas/áreas: guía vertical punteada. */
export const chartCursor = {
  stroke: 'rgb(var(--ink-muted))',
  strokeWidth: 1,
  strokeDasharray: '3 3',
  strokeOpacity: 0.5,
} as const

/** Cursor de barras: banda suave detrás de la barra. */
export const chartBarCursor = { fill: 'rgb(var(--ink-muted) / 0.08)', radius: 6 } as const

/** Punto activo con aro del color de la tarjeta (se despega del trazo). */
export function chartActiveDot(color: string) {
  return { r: 5, fill: color, stroke: 'rgb(var(--surface-card))', strokeWidth: 2.5 }
}

/** Bordes redondeados arriba (barras verticales). */
export const chartBarRadius: [number, number, number, number] = [6, 6, 2, 2]

/** Degradé vertical para áreas: color arriba que se desvanece abajo. Poner dentro del chart. */
export function ChartAreaGradient({ id, color, opacity = 0.32 }: { id: string; color: string; opacity?: number }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={opacity} />
        <stop offset="95%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  )
}

/** Degradé de barra (más intenso arriba). */
export function ChartBarGradient({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={1} />
        <stop offset="100%" stopColor={color} stopOpacity={0.55} />
      </linearGradient>
    </defs>
  )
}

/** Montos compactos para ejes: $12k, −$450k, $1,2M. */
export function compactCurrency(v: number): string {
  if (v === 0) return '$0'
  const sign = v < 0 ? '−' : ''
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')}M`
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}k`
  return `${sign}$${Math.round(abs)}`
}

type TooltipEntry = {
  name?: string | number
  value?: number | string | (number | string)[]
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

/**
 * Tooltip de tarjeta: título (label) + una fila por serie con su punto de color.
 * `formatValue` formatea cada valor; `formatLabel` el título; `footer` agrega una línea final.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatValue = (v) => String(v),
  formatLabel = (l) => String(l ?? ''),
  footer,
  className,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  formatValue?: (value: number, entry: TooltipEntry) => ReactNode
  formatLabel?: (label: string | number | undefined, payload: TooltipEntry[]) => ReactNode
  footer?: (payload: TooltipEntry[]) => ReactNode
  className?: string
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => p.value != null && p.value !== '')
  return (
    <div
      className={cn(
        'min-w-[9rem] rounded-xl border border-surface-border bg-surface-card/95 px-3 py-2 text-2xs shadow-pop backdrop-blur',
        className,
      )}
    >
      <p className="mb-1.5 font-semibold text-ink-primary">{formatLabel(label, payload)}</p>
      <ul className="space-y-1">
        {rows.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink-secondary">{p.name}</span>
            <span className="font-semibold tabular-nums text-ink-primary">{formatValue(Number(p.value), p)}</span>
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-1.5 border-t border-surface-border/70 pt-1.5 text-ink-muted">{footer(payload)}</div> : null}
    </div>
  )
}

/** Leyenda horizontal en chips (se ve en mobile mejor que la leyenda nativa). */
export function ChartLegend({ items, className }: { items: { label: string; color: string }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-3 gap-y-1', className)}>
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5 text-2xs text-ink-secondary">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

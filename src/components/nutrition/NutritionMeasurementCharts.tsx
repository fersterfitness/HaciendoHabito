import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NutritionMeasurement } from '@/types/database'
import { mergedMediansForPresentation } from '@/lib/nutrition/anthropometryPresentation'
import {
  ANTHRO_PERIMETER_KEYS,
  ANTHRO_SKINFOLD_KEYS,
  labelForAnthroKey,
  type AnthropometryVariableKey,
} from '@/lib/nutrition/anthropometryProgramModel'

const CHART_STROKE_SECONDARY = 'rgb(169, 121, 255)'
const CHART_STROKE_TERTIARY = 'rgb(255, 79, 234)'

type TimePoint = { label: string } & Record<string, number | null | string>

type VariableChart = {
  key: AnthropometryVariableKey
  label: string
  unit: string
  stroke: string
  points: number
}

function gradientIdFor(key: string) {
  return `anthro-fill-${key.replace(/[^a-z0-9]/gi, '-')}`
}

function countPoints(data: TimePoint[], key: string): number {
  return data.filter((d) => d[key] != null && typeof d[key] === 'number').length
}

function buildCharts(
  keys: readonly AnthropometryVariableKey[],
  unit: string,
  data: TimePoint[],
  colorOffset: number,
): VariableChart[] {
  const charts: VariableChart[] = []
  keys.forEach((key, i) => {
    const points = countPoints(data, key)
    if (points === 0) return
    charts.push({
      key,
      label: labelForAnthroKey(key),
      unit,
      stroke: (colorOffset + i) % 2 === 0 ? CHART_STROKE_SECONDARY : CHART_STROKE_TERTIARY,
      points,
    })
  })
  return charts
}

function buildTimeSeries(measurements: NutritionMeasurement[]): TimePoint[] {
  const sorted = [...measurements].sort(
    (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
  )
  const keys = [...ANTHRO_PERIMETER_KEYS, ...ANTHRO_SKINFOLD_KEYS] as const
  return sorted.map((m) => {
    const med = mergedMediansForPresentation(m)
    const row: TimePoint = { label: format(parseISO(m.measured_at), 'dd/MM/yy') }
    for (const k of keys) {
      const v = med[k]
      row[k] = v != null && Number.isFinite(v) ? v : null
    }
    return row
  })
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  title,
}: {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
  unit: string
  title: string
}) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  if (v == null) return null
  return (
    <div className="rounded-xl border border-brand-secondary/25 bg-surface-card/95 px-3 py-2 shadow-lg shadow-black/20 backdrop-blur-sm">
      <p className="text-[10px] text-ink-muted">{label}</p>
      <p className="text-sm font-semibold text-brand-secondary tabular-nums">
        {v} {unit}
      </p>
      <p className="text-[10px] text-ink-muted mt-0.5">{title}</p>
    </div>
  )
}

function EvolutionAreaChart({
  title,
  unit,
  dataKey,
  data,
  stroke,
  points,
}: {
  title: string
  unit: string
  dataKey: string
  data: TimePoint[]
  stroke: string
  points: number
}) {
  const fillId = gradientIdFor(dataKey)
  return (
    <div className="rounded-2xl border border-brand-secondary/15 bg-gradient-to-br from-brand-secondary/[0.07] via-transparent to-brand-tertiary/[0.04] p-4 shadow-sm shadow-black/5">
      <p className="text-xs font-semibold text-ink-primary mb-3">
        {title}
        <span className="ml-1.5 font-normal text-ink-muted">({unit})</span>
        {points === 1 ? <span className="ml-2 font-normal text-ink-muted">· 1 control</span> : null}
      </p>
      <div className="h-[176px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.38} />
                <stop offset="85%" stopColor={stroke} stopOpacity={0.04} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 6"
              stroke="rgb(var(--surface-border))"
              strokeOpacity={0.55}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'rgb(var(--ink-muted))' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'rgb(var(--ink-muted))' }}
              domain={['auto', 'auto']}
              width={36}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<ChartTooltip unit={unit} title={title} />}
              cursor={{ stroke: stroke, strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.45 }}
            />
            <Area
              type="natural"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={2.5}
              fill={`url(#${fillId})`}
              dot={{
                r: 4,
                fill: stroke,
                stroke: 'rgb(var(--surface-card))',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: stroke,
                stroke: 'rgb(var(--surface-card))',
                strokeWidth: 2,
              }}
              connectNulls={false}
              isAnimationActive
              animationDuration={480}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ChartSection({
  sectionTitle,
  charts,
  data,
}: {
  sectionTitle: string
  charts: VariableChart[]
  data: TimePoint[]
}) {
  if (charts.length === 0) return null
  const needsSecond = charts.some((c) => c.points === 1)
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-secondary/90">
        {sectionTitle}
      </p>
      {needsSecond ? (
        <p className="text-xs text-ink-muted rounded-xl border border-surface-border/80 bg-surface-elevated/30 px-3 py-2">
          Algunas variables tienen un solo control: cargá otra medición para ver la tendencia entre fechas.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {charts.map((c) => (
          <EvolutionAreaChart
            key={c.key}
            title={c.label}
            unit={c.unit}
            dataKey={c.key}
            data={data}
            stroke={c.stroke}
            points={c.points}
          />
        ))}
      </div>
    </div>
  )
}

export function NutritionMeasurementCharts({ measurements }: { measurements: NutritionMeasurement[] }) {
  const { data, perimeterCharts, skinfoldCharts } = useMemo(() => {
    const rows = buildTimeSeries(measurements)
    const perimeters = buildCharts(ANTHRO_PERIMETER_KEYS, 'cm', rows, 0)
    const skinfolds = buildCharts(ANTHRO_SKINFOLD_KEYS, 'mm', rows, perimeters.length)
    return { data: rows, perimeterCharts: perimeters, skinfoldCharts: skinfolds }
  }, [measurements])

  const count = data.length
  const hasAny = perimeterCharts.length > 0 || skinfoldCharts.length > 0

  if (count === 0) {
    return (
      <p className="text-sm text-ink-muted py-2">
        Guardá un control con el programa de antropometría (perímetros y pliegues) para ver la evolución acá.
      </p>
    )
  }

  if (!hasAny) {
    return (
      <p className="text-sm text-ink-muted py-2">
        Hay {count === 1 ? 'una medición guardada' : `${count} mediciones guardadas`}, pero sin perímetros ni
        pliegues en las medianas del programa. Completá esas filas en el formulario de la izquierda y volvé a
        guardar.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {count === 1 ? (
        <p className="text-xs text-ink-muted rounded-xl border border-surface-border/80 bg-surface-elevated/30 px-3 py-2">
          Primera medición registrada. Con un segundo control vas a ver la curva de evolución entre fechas.
        </p>
      ) : null}

      <ChartSection sectionTitle="Perímetros" charts={perimeterCharts} data={data} />
      <ChartSection sectionTitle="Pliegues cutáneos" charts={skinfoldCharts} data={data} />
    </div>
  )
}

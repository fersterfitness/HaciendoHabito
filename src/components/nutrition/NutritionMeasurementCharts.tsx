import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
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
import { brandRgb } from '@/theme/brandColors'
import { cn } from '@/lib/utils'

const CHART_STROKE_SECONDARY = brandRgb('secondary')
const CHART_STROKE_TERTIARY = brandRgb('tertiary')

type TimePoint = { label: string } & Record<string, number | null | string>

type VariableMeta = {
  key: AnthropometryVariableKey
  label: string
  unit: string
  stroke: string
  group: 'perimeter' | 'skinfold'
  points: number
  latest: number | null
  delta: number | null
  min: number | null
  max: number | null
  avg: number | null
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

/** Estadísticas de la serie: último, variación vs control previo, min/max/promedio. */
function seriesStats(data: TimePoint[], key: string): Omit<VariableMeta, 'key' | 'label' | 'unit' | 'stroke' | 'group'> {
  const vals: number[] = []
  for (const d of data) {
    const v = d[key]
    if (typeof v === 'number' && Number.isFinite(v)) vals.push(v)
  }
  const points = vals.length
  if (points === 0) {
    return { points: 0, latest: null, delta: null, min: null, max: null, avg: null }
  }
  const latest = vals[vals.length - 1]!
  const delta = points >= 2 ? round1(vals[vals.length - 1]! - vals[vals.length - 2]!) : null
  const min = round1(Math.min(...vals))
  const max = round1(Math.max(...vals))
  const avg = round1(vals.reduce((a, b) => a + b, 0) / points)
  return { points, latest, delta, min, max, avg }
}

function gradientIdFor(key: string) {
  return `anthro-fill-${key.replace(/[^a-z0-9]/gi, '-')}`
}

function buildVariables(
  keys: readonly AnthropometryVariableKey[],
  unit: string,
  data: TimePoint[],
  stroke: string,
  group: 'perimeter' | 'skinfold',
): VariableMeta[] {
  const out: VariableMeta[] = []
  keys.forEach((key) => {
    const stats = seriesStats(data, key)
    if (stats.points === 0) return
    out.push({ key, label: labelForAnthroKey(key), unit, stroke, group, ...stats })
  })
  return out
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

/** Resumen compacto de cada variable (perímetros/pliegues) para el análisis IA. */
export type AnthroVariableSummary = {
  group: 'perimeter' | 'skinfold'
  label: string
  unit: string
  points: number
  latest: number | null
  first: number | null
  min: number | null
  max: number | null
  avg: number | null
}

export function summarizeMeasurementVariables(
  measurements: NutritionMeasurement[],
): AnthroVariableSummary[] {
  const rows = buildTimeSeries(measurements)
  const collect = (
    keys: readonly AnthropometryVariableKey[],
    unit: string,
    group: 'perimeter' | 'skinfold',
  ): AnthroVariableSummary[] => {
    const out: AnthroVariableSummary[] = []
    keys.forEach((key) => {
      const vals: number[] = []
      for (const d of rows) {
        const v = d[key]
        if (typeof v === 'number' && Number.isFinite(v)) vals.push(v)
      }
      if (vals.length === 0) return
      const stats = seriesStats(rows, key)
      out.push({
        group,
        label: labelForAnthroKey(key),
        unit,
        points: stats.points,
        latest: stats.latest,
        first: vals[0]!,
        min: stats.min,
        max: stats.max,
        avg: stats.avg,
      })
    })
    return out
  }
  return [
    ...collect(ANTHRO_PERIMETER_KEYS, 'cm', 'perimeter'),
    ...collect(ANTHRO_SKINFOLD_KEYS, 'mm', 'skinfold'),
  ]
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  title,
  stroke,
}: {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
  unit: string
  title: string
  stroke?: string
}) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  if (v == null) return null
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card/95 px-3 py-2 shadow-lg shadow-black/20 backdrop-blur-sm">
      <p className="text-[10px] text-ink-muted">{label}</p>
      <p className="text-sm font-semibold tabular-nums" style={{ color: stroke }}>
        {v} {unit}
      </p>
      <p className="text-[10px] text-ink-muted mt-0.5">{title}</p>
    </div>
  )
}

/** Chip de variable con micro-resumen (último valor) para elegir qué serie ver. */
function VariableChip({
  meta,
  active,
  onSelect,
}: {
  meta: VariableMeta
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-transparent text-white shadow-sm'
          : 'border-surface-border/70 bg-surface-card text-ink-secondary hover:border-surface-border hover:text-ink-primary',
      )}
      style={active ? { backgroundColor: meta.stroke } : undefined}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: active ? 'rgba(255,255,255,0.85)' : meta.stroke }}
        aria-hidden
      />
      <span className="font-medium">{meta.label}</span>
      {meta.latest != null ? (
        <span className={cn('tabular-nums', active ? 'text-white/80' : 'text-ink-muted')}>
          {meta.latest}
          {meta.unit}
        </span>
      ) : null}
    </button>
  )
}

function StatPill({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-xl border border-surface-border/60 bg-surface-elevated/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink-primary">
        {value != null ? value : '—'}
        {value != null ? <span className="ml-0.5 text-[10px] font-normal text-ink-muted">{unit}</span> : null}
      </p>
    </div>
  )
}

/** Gráfico grande de una sola variable: aprovecha el ancho y muestra detalle/estadísticas. */
function FeaturedChart({ meta, data }: { meta: VariableMeta; data: TimePoint[] }) {
  const fillId = gradientIdFor(meta.key)
  const { stroke, unit, label, latest, delta, points } = meta
  const deltaIsZero = delta != null && delta === 0
  return (
    <div className="rounded-2xl border border-surface-border/70 bg-surface-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stroke }} aria-hidden />
            <p className="truncate text-sm font-semibold text-ink-primary">{label}</p>
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            {meta.group === 'perimeter' ? 'Perímetro' : 'Pliegue cutáneo'} · {unit} ·{' '}
            {points === 1 ? '1 control' : `${points} controles`}
          </p>
        </div>
        {latest != null ? (
          <div className="flex shrink-0 flex-col items-end leading-none">
            <span className="text-2xl font-bold tabular-nums" style={{ color: stroke }}>
              {latest}
              <span className="ml-1 text-xs font-normal text-ink-muted">{unit}</span>
            </span>
            {delta != null ? (
              <span
                className={cn(
                  'mt-1.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
                  deltaIsZero ? 'bg-surface-elevated/50 text-ink-muted' : 'text-white',
                )}
                style={deltaIsZero ? undefined : { backgroundColor: stroke }}
              >
                {deltaIsZero ? (
                  <Minus className="h-3 w-3" aria-hidden />
                ) : delta > 0 ? (
                  <ArrowUp className="h-3 w-3" aria-hidden />
                ) : (
                  <ArrowDown className="h-3 w-3" aria-hidden />
                )}
                {delta > 0 ? '+' : ''}
                {delta} {unit}
                <span className={cn('ml-0.5 font-normal', deltaIsZero ? 'text-ink-muted' : 'text-white/70')}>
                  vs previo
                </span>
              </span>
            ) : (
              <span className="mt-1.5 text-[11px] text-ink-muted">Sin control previo</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
                <stop offset="85%" stopColor={stroke} stopOpacity={0.05} />
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
              tick={{ fontSize: 11, fill: 'rgb(var(--ink-muted))' }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'rgb(var(--ink-muted))' }}
              domain={['auto', 'auto']}
              width={40}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<ChartTooltip unit={unit} title={label} stroke={stroke} />}
              cursor={{ stroke, strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.45 }}
            />
            <Area
              type="natural"
              dataKey={meta.key}
              stroke={stroke}
              strokeWidth={2.5}
              fill={`url(#${fillId})`}
              dot={{ r: 4, fill: stroke, stroke: 'rgb(var(--surface-card))', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: stroke, stroke: 'rgb(var(--surface-card))', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive
              animationDuration={480}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Actual" value={latest} unit={unit} />
        <StatPill label="Promedio" value={meta.avg} unit={unit} />
        <StatPill label="Mínimo" value={meta.min} unit={unit} />
        <StatPill label="Máximo" value={meta.max} unit={unit} />
      </div>
    </div>
  )
}

function ChipGroup({
  title,
  accent,
  variables,
  selectedKey,
  onSelect,
}: {
  title: string
  accent: string
  variables: VariableMeta[]
  selectedKey: AnthropometryVariableKey
  onSelect: (k: AnthropometryVariableKey) => void
}) {
  if (variables.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
          {title}
        </p>
        <span className="text-[11px] font-normal text-ink-muted">· {variables.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {variables.map((meta) => (
          <VariableChip
            key={meta.key}
            meta={meta}
            active={meta.key === selectedKey}
            onSelect={() => onSelect(meta.key)}
          />
        ))}
      </div>
    </div>
  )
}

export function NutritionMeasurementCharts({ measurements }: { measurements: NutritionMeasurement[] }) {
  const { data, perimeters, skinfolds, allVariables } = useMemo(() => {
    const rows = buildTimeSeries(measurements)
    const perim = buildVariables(ANTHRO_PERIMETER_KEYS, 'cm', rows, CHART_STROKE_SECONDARY, 'perimeter')
    const skin = buildVariables(ANTHRO_SKINFOLD_KEYS, 'mm', rows, CHART_STROKE_TERTIARY, 'skinfold')
    return { data: rows, perimeters: perim, skinfolds: skin, allVariables: [...perim, ...skin] }
  }, [measurements])

  const [selectedKey, setSelectedKey] = useState<AnthropometryVariableKey | null>(null)

  const count = data.length
  const selected = useMemo(() => {
    if (allVariables.length === 0) return null
    return allVariables.find((v) => v.key === selectedKey) ?? allVariables[0]!
  }, [allVariables, selectedKey])

  if (count === 0) {
    return (
      <p className="text-sm text-ink-muted py-2">
        Guardá un control con el programa de antropometría (perímetros y pliegues) para ver la evolución acá.
      </p>
    )
  }

  if (!selected) {
    return (
      <p className="text-sm text-ink-muted py-2">
        Hay {count === 1 ? 'una medición guardada' : `${count} mediciones guardadas`}, pero sin perímetros ni
        pliegues en las medianas del programa. Completá esas filas en el formulario de la izquierda y volvé a
        guardar.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {count === 1 ? (
        <p className="text-xs text-ink-muted rounded-xl border border-surface-border/80 bg-surface-elevated/30 px-3 py-2">
          Primera medición registrada. Con un segundo control vas a ver la curva de evolución entre fechas.
        </p>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-surface-border/60 bg-surface-elevated/20 p-4 sm:grid-cols-2">
        <ChipGroup
          title="Perímetros"
          accent={CHART_STROKE_SECONDARY}
          variables={perimeters}
          selectedKey={selected.key}
          onSelect={setSelectedKey}
        />
        <ChipGroup
          title="Pliegues cutáneos"
          accent={CHART_STROKE_TERTIARY}
          variables={skinfolds}
          selectedKey={selected.key}
          onSelect={setSelectedKey}
        />
      </div>

      <FeaturedChart meta={selected} data={data} />
    </div>
  )
}

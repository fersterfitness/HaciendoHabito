import { type ReactNode, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NutritionMeasurement } from '@/types/database'
import { mergedMediansForPresentation } from '@/lib/nutrition/anthropometryPresentation'
import {
  ANTHRO_PERIMETER_KEYS,
  ANTHRO_SKINFOLD_KEYS,
  labelForAnthroKey,
} from '@/lib/nutrition/anthropometryProgramModel'
import { ChartSizedContainer } from '@/components/charts/ChartSizedContainer'
import { ChartTooltip, chartActiveDot, chartAxis, chartCursor, chartGrid } from '@/components/charts/chartKit'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Evolución de perímetros y pliegues (v2): neutro, nombres completos, coma decimal y el cambio
 * coloreado sólo cuando se sabe qué es mejora. Con menos de 3 controles no hay curva: se comparan.
 */

type Dir = 'down' | 'neutral'
type Group = 'perimeter' | 'skinfold'

interface Variable {
  key: string
  label: string
  unit: 'cm' | 'mm'
  group: Group
  dir: Dir
  /** Valores por control, del más viejo al más nuevo (null si ese control no la tiene). */
  values: (number | null)[]
}

interface Control {
  iso: string
  short: string
  full: string
}

const SUM6 = ['triceps_mm', 'subescapular_mm', 'supraespinal_mm', 'abdominal_mm', 'muslo_medial_mm', 'pantorrilla_max_mm']

/** Bajar es mejora: pliegues y cintura. El resto depende del objetivo del paciente. */
const DOWN_IS_BETTER = new Set<string>([...ANTHRO_SKINFOLD_KEYS, 'sum6', 'cintura_min_cm'])

const nf = (v: number, d = 1) => formatNumber(v, d)
const r1 = (v: number) => Math.round(v * 10) / 10

function shortLabel(key: string, group: Group): string {
  if (key === 'sum6') return 'Σ 6 pliegues'
  const l = labelForAnthroKey(key as Parameters<typeof labelForAnthroKey>[0])
  return group === 'skinfold' ? l.replace(/\s*\((?:pliegue)\)\s*/i, '') : l
}

function buildData(measurements: NutritionMeasurement[]) {
  const sorted = [...measurements].sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
  const meds = sorted.map((m) => mergedMediansForPresentation(m) as Record<string, number | null | undefined>)
  const controls: Control[] = sorted.map((m) => ({
    iso: m.measured_at,
    short: format(parseISO(m.measured_at), 'd MMM yy', { locale: es }),
    full: format(parseISO(m.measured_at), "d 'de' MMMM yyyy", { locale: es }),
  }))
  const val = (md: Record<string, number | null | undefined>, k: string) => {
    if (k === 'sum6') {
      const xs = SUM6.map((s) => md[s])
      return xs.every((x) => x != null && Number.isFinite(x)) ? r1((xs as number[]).reduce((a, b) => a + b, 0)) : null
    }
    const v = md[k]
    return v != null && Number.isFinite(v) ? v : null
  }
  const make = (keys: readonly string[], unit: 'cm' | 'mm', group: Group): Variable[] =>
    keys
      .map((key) => ({
        key,
        label: shortLabel(key, group),
        unit,
        group,
        dir: (DOWN_IS_BETTER.has(key) ? 'down' : 'neutral') as Dir,
        values: meds.map((md) => val(md, key)),
      }))
      .filter((v) => v.values.some((x) => x != null))
  return {
    controls,
    perimeters: make(ANTHRO_PERIMETER_KEYS, 'cm', 'perimeter'),
    skinfolds: make([...ANTHRO_SKINFOLD_KEYS, 'sum6'], 'mm', 'skinfold'),
  }
}

function points(v: Variable, controls: Control[]) {
  return v.values.flatMap((x, i) => (x == null ? [] : [{ value: x, control: controls[i]! }]))
}

function toneOf(delta: number | null, dir: Dir) {
  if (delta == null || Math.abs(delta) < 0.05 || dir === 'neutral') return 'text-ink-secondary'
  return delta < 0 ? 'text-status-generated' : 'text-status-expired'
}

function Delta({ value, unit, dir, className }: { value: number | null; unit: string; dir: Dir; className?: string }) {
  if (value == null) return null
  const zero = Math.abs(value) < 0.05
  const Icon = zero ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', toneOf(value, dir), className)}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {zero ? 'sin cambios' : `${value > 0 ? '+' : '−'}${nf(Math.abs(value))} ${unit}`}
    </span>
  )
}

function VariableChip({ v, controls, active, onSelect }: { v: Variable; controls: Control[]; active: boolean; onSelect: () => void }) {
  const pts = points(v, controls)
  const last = pts[pts.length - 1]
  const first = pts[0]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'flex min-w-0 flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors',
        active
          ? 'border-brand-primary/60 bg-brand-primary/5 ring-1 ring-inset ring-brand-primary/30'
          : 'border-surface-border/70 bg-surface-card hover:border-surface-border',
      )}
    >
      <span className="w-full text-2xs font-medium leading-snug text-ink-secondary">{v.label}</span>
      <span className="mt-0.5 flex w-full flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-sm font-semibold tabular-nums text-ink-primary">
          {last ? nf(last.value, 2) : '—'}
          <span className="ml-0.5 text-3xs font-normal text-ink-muted">{v.unit}</span>
        </span>
        {last && first && pts.length > 1 ? <Delta value={r1(last.value - first.value)} unit="" dir={v.dir} className="text-3xs" /> : null}
      </span>
    </button>
  )
}

function Featured({ v, controls }: { v: Variable; controls: Control[] }) {
  const pts = points(v, controls)
  const first = pts[0]
  const last = pts[pts.length - 1]
  const prev = pts[pts.length - 2]
  if (!first || !last) return null
  const values = pts.map((p) => p.value)
  const lo = Math.floor(Math.min(...values) - 1)
  const hi = Math.ceil(Math.max(...values) + 1)
  const chartData = pts.map((p) => ({ label: p.control.short, full: p.control.full, valor: p.value }))

  return (
    <div className="rounded-2xl border border-surface-border/70 bg-surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-primary">{v.label}</p>
          <p className="mt-0.5 text-2xs text-ink-muted">
            {v.group === 'perimeter' ? 'Perímetro' : v.key === 'sum6' ? 'Suma de pliegues' : 'Pliegue cutáneo'} · {v.unit} ·{' '}
            {pts.length === 1 ? '1 control' : `${pts.length} controles`}
            {v.dir === 'neutral' ? ' · subir o bajar depende del objetivo' : ' · bajar es mejora'}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="leading-none">
            <span className="text-[28px] font-semibold tracking-tight tabular-nums text-ink-primary">{nf(last.value, 2)}</span>
            <span className="ml-1 text-xs text-ink-muted">{v.unit}</span>
          </p>
          <p className="mt-1.5 text-2xs">
            {prev ? (
              <>
                <Delta value={r1(last.value - first.value)} unit={v.unit} dir={v.dir} />
                <span className="ml-1 text-ink-muted">desde el primer control</span>
              </>
            ) : (
              <span className="text-ink-muted">Sin control previo</span>
            )}
          </p>
        </div>
      </div>

      {pts.length >= 3 ? (
        <>
          <ChartSizedContainer className="mt-4 h-[240px] w-full" minHeight={240}>
            {({ width, height }) => (
              <ResponsiveContainer width={width} height={height}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chartGrid} />
                  <XAxis dataKey="label" {...chartAxis} padding={{ left: 8, right: 16 }} />
                  <YAxis {...chartAxis} width={38} domain={[lo, hi]} allowDecimals={false} tickCount={Math.min(hi - lo + 1, 6)} tickFormatter={(x: number) => nf(x, 0)} />
                  <Tooltip
                    cursor={chartCursor}
                    content={
                      <ChartTooltip
                        formatValue={(x) => `${nf(x, 2)} ${v.unit}`}
                        formatLabel={(_l, p) => (p[0]?.payload as { full?: string } | undefined)?.full ?? ''}
                      />
                    }
                  />
                  <ReferenceLine y={first.value} stroke="rgb(var(--ink-muted))" strokeDasharray="4 4" strokeOpacity={0.6} />
                  <Line
                    type="linear"
                    dataKey="valor"
                    name={v.label}
                    stroke="rgb(var(--ink-primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'rgb(var(--ink-primary))', stroke: 'rgb(var(--surface-card))', strokeWidth: 2 }}
                    activeDot={chartActiveDot('rgb(var(--brand-primary))')}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartSizedContainer>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Primer control" value={`${nf(first.value, 2)} ${v.unit}`} sub={first.control.short} />
            <Stat label="Mínimo" value={`${nf(Math.min(...values), 2)} ${v.unit}`} />
            <Stat label="Máximo" value={`${nf(Math.max(...values), 2)} ${v.unit}`} />
          </div>
        </>
      ) : pts.length === 2 && prev ? (
        <div className="mt-4 flex items-stretch gap-2">
          <Compare label={prev.control.full} value={`${nf(prev.value, 2)} ${v.unit}`} />
          <span className="flex items-center text-ink-muted">
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
          <Compare label={last.control.full} value={`${nf(last.value, 2)} ${v.unit}`} strong />
        </div>
      ) : null}

      {pts.length < 3 ? (
        <p className="mt-3 text-2xs text-ink-muted">La curva de evolución aparece a partir del tercer control.</p>
      ) : null}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-elevated/50 px-3 py-2">
      <p className="text-3xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink-primary">{value}</p>
      {sub ? <p className="text-3xs text-ink-muted">{sub}</p> : null}
    </div>
  )
}

function Compare({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-surface-elevated/50 px-3 py-2.5">
      <p className="truncate text-3xs text-ink-muted">{label}</p>
      <p className={cn('mt-0.5 text-base tabular-nums', strong ? 'font-semibold text-ink-primary' : 'text-ink-secondary')}>{value}</p>
    </div>
  )
}

function ChipGroup({
  title,
  vars,
  controls,
  selected,
  onSelect,
}: {
  title: string
  vars: Variable[]
  controls: Control[]
  selected: string
  onSelect: (k: string) => void
}) {
  if (!vars.length) return null
  return (
    <div>
      <p className="mb-2 text-2xs font-semibold text-ink-muted">
        {title} <span className="font-normal">· {vars.length}</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {vars.map((v) => (
          <VariableChip key={v.key} v={v} controls={controls} active={v.key === selected} onSelect={() => onSelect(v.key)} />
        ))}
      </div>
    </div>
  )
}

export function NutritionMeasurementChartsV2({ measurements }: { measurements: NutritionMeasurement[] }) {
  const { controls, perimeters, skinfolds } = useMemo(() => buildData(measurements), [measurements])
  const all = useMemo(() => [...perimeters, ...skinfolds], [perimeters, skinfolds])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = all.find((v) => v.key === selectedKey) ?? all[0] ?? null

  if (!controls.length) {
    return <p className="py-2 text-sm text-ink-muted">Guardá un control con perímetros y pliegues para ver la evolución acá.</p>
  }
  if (!selected) {
    return (
      <p className="py-2 text-sm text-ink-muted">
        {controls.length === 1 ? 'Hay un control guardado' : `Hay ${controls.length} controles guardados`}, pero sin perímetros ni
        pliegues. Se completan en el programa de antropometría o importando el informe PDF.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-surface-border/60 bg-surface-elevated/20 p-3 sm:p-4">
        <ChipGroup title="Perímetros (cm)" vars={perimeters} controls={controls} selected={selected.key} onSelect={setSelectedKey} />
        <ChipGroup title="Pliegues cutáneos (mm)" vars={skinfolds} controls={controls} selected={selected.key} onSelect={setSelectedKey} />
      </div>
      <Featured v={selected} controls={controls} />
    </div>
  )
}

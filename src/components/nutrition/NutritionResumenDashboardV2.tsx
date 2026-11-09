import { type ReactNode, useMemo } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, ClipboardList, Minus, Upload, Utensils } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { differenceInCalendarDays, differenceInYears, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChartSizedContainer } from '@/components/charts/ChartSizedContainer'
import { ChartTooltip, chartActiveDot, chartAxis, chartCursor, chartGrid } from '@/components/charts/chartKit'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { NextConsultationBanner } from './NutritionResumenDashboard'
import { fatOf, muscleOf, waistOf, weightOf } from '@/lib/nutrition/measurementDerivatives'
import type { AnthropometryDetail } from '@/lib/nutrition/anthropometryProgramModel'
import type { NutritionMeasurement, NutritionPatientFollowup, Student } from '@/types/database'
import { cn, formatNumber } from '@/lib/utils'

interface Props {
  student?: Student | null
  measurements: NutritionMeasurement[]
  followup: NutritionPatientFollowup | null
  onGoToTab: (tabId: string) => void
  onManageAppointments: () => void
}

export type Dir = 'down' | 'up' | 'neutral'

export interface Metric {
  key: string
  label: string
  short: string
  unit: string
  dir: Dir
  get: (m: NutritionMeasurement, heightCm: number | null) => number | null
}

const SKINFOLDS = ['triceps_mm', 'subescapular_mm', 'supraespinal_mm', 'abdominal_mm', 'muslo_medial_mm', 'pantorrilla_max_mm']

function medians(m: NutritionMeasurement) {
  return (m.detail as AnthropometryDetail | null)?.medians ?? null
}

function bmiOf(m: NutritionMeasurement, heightCm: number | null): number | null {
  if (m.bmi != null) return m.bmi
  const w = weightOf(m)
  const h = (m.height_cm ?? medians(m)?.talla_corporal_cm ?? heightCm) ?? null
  if (!w || !h) return null
  return Math.round((w / (h / 100) ** 2) * 10) / 10
}

function sum6Of(m: NutritionMeasurement): number | null {
  const md = medians(m)
  if (!md) return null
  const vals = SKINFOLDS.map((k) => md[k])
  if (vals.some((v) => v == null)) return null
  return Math.round((vals as number[]).reduce((a, b) => a + b, 0) * 10) / 10
}

/** Métricas de composición: se muestran sólo las que tienen algún dato cargado. */
export const METRICS: Metric[] = [
  { key: 'bmi', label: 'IMC', short: 'IMC', unit: '', dir: 'neutral', get: bmiOf },
  { key: 'fat', label: '% Grasa', short: '% Grasa', unit: '%', dir: 'down', get: (m) => fatOf(m) },
  { key: 'muscle', label: 'Masa muscular', short: 'Músculo', unit: 'kg', dir: 'up', get: (m) => muscleOf(m) },
  { key: 'waist', label: 'Cintura', short: 'Cintura', unit: 'cm', dir: 'down', get: (m) => waistOf(m) },
  { key: 'hip', label: 'Cadera', short: 'Cadera', unit: 'cm', dir: 'neutral', get: (m) => medians(m)?.cadera_max_cm ?? null },
  { key: 'sum6', label: 'Σ 6 pliegues', short: 'Σ6 pl.', unit: 'mm', dir: 'down', get: (m) => sum6Of(m) },
]

export const nf = (v: number, d = 1) => formatNumber(v, d)

function signed(v: number, unit: string) {
  const s = v > 0 ? '+' : v < 0 ? '−' : '±'
  return `${s}${nf(Math.abs(v))}${unit ? ` ${unit}` : ''}`
}

function toneOf(delta: number | null, dir: Dir) {
  if (delta == null || Math.abs(delta) < 0.05 || dir === 'neutral') return 'text-ink-secondary'
  return (dir === 'down' ? delta < 0 : delta > 0) ? 'text-status-generated' : 'text-status-expired'
}

export function Delta({ value, unit, dir, className }: { value: number | null; unit: string; dir: Dir; className?: string }) {
  if (value == null) return null
  const Icon = Math.abs(value) < 0.05 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', toneOf(value, dir), className)}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {Math.abs(value) < 0.05 ? 'sin cambios' : signed(value, unit)}
    </span>
  )
}

function spanLabel(fromIso: string, toIso: string) {
  const days = differenceInCalendarDays(parseISO(toIso), parseISO(fromIso))
  if (days < 14) return `${days} ${days === 1 ? 'día' : 'días'}`
  if (days < 90) return `${Math.round(days / 7)} semanas`
  return `${Math.round(days / 30.4)} meses`
}

export function NutritionResumenDashboardV2({ student, measurements, followup, onGoToTab, onManageAppointments }: Props) {
  const heightCm = student?.height_cm ?? null
  const age = useMemo(() => {
    if (!student?.birth_date) return null
    const y = differenceInYears(new Date(), new Date(student.birth_date))
    return Number.isFinite(y) && y >= 0 && y < 130 ? y : null
  }, [student?.birth_date])

  const ordered = useMemo(
    () => [...measurements].sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()),
    [measurements],
  )
  const weighed = ordered.filter((m) => weightOf(m) != null)
  const latest = ordered[ordered.length - 1]
  const lastW = weighed[weighed.length - 1]
  const prevW = weighed[weighed.length - 2]
  const firstW = weighed[0]
  const regWeight = student?.weight_kg ?? null

  const current = lastW ? weightOf(lastW) : null
  const sincePrev = current != null && prevW ? current - (weightOf(prevW) as number) : null
  /** Base: el primer control; si hay uno solo, el peso que dejó en el formulario de registro. */
  const base = weighed.length >= 2 ? { w: weightOf(firstW) as number, label: `desde el primer control (${format(parseISO(firstW.measured_at), "d MMM yy", { locale: es })})`, iso: firstW.measured_at } : regWeight != null && current != null ? { w: regWeight, label: 'desde el registro', iso: student?.created_at ?? null } : null
  const sinceStart = current != null && base ? current - base.w : null

  const metrics = METRICS.filter((mt) => ordered.some((m) => mt.get(m, heightCm) != null))
  const missing = [
    !metrics.some((m) => m.key === 'fat') && '% grasa',
    !metrics.some((m) => m.key === 'muscle') && 'masa muscular',
    !metrics.some((m) => m.key === 'waist') && 'cintura',
  ].filter(Boolean) as string[]

  const chartData = weighed.map((m) => ({
    label: format(parseISO(m.measured_at), 'd MMM', { locale: es }),
    full: format(parseISO(m.measured_at), "d 'de' MMMM yyyy", { locale: es }),
    peso: weightOf(m),
  }))

  const rows = [...ordered].reverse().slice(0, 6)
  const profile = [
    heightCm != null && `${nf(heightCm, 0)} cm`,
    age != null && `${age} años`,
    student?.gender === 'M' ? 'Masculino' : student?.gender === 'F' ? 'Femenino' : student?.gender ? 'Otro' : null,
    regWeight != null && `${nf(regWeight)} kg al registrarse`,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-4">
      <NextConsultationBanner studentId={student?.id ?? ''} followup={followup} onManageAppointments={onManageAppointments} />

      <Card padding="md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-3xs font-semibold text-ink-muted">Peso actual</p>
            {current != null ? (
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums text-ink-primary">{nf(current)}</span>
                <span className="text-sm text-ink-muted">kg</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-secondary">Sin controles con peso todavía</p>
            )}
            {lastW ? (
              <p className="mt-1.5 text-2xs text-ink-muted">
                Último control: {format(parseISO(lastW.measured_at), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            ) : null}
          </div>
          <Button type="button" size="sm" variant={ordered.length ? 'outline' : 'primary'} onClick={() => onGoToTab('antropometria-nuevo')}>
            {ordered.length ? 'Nuevo control' : 'Cargar primera medición'}
          </Button>
        </div>

        {sinceStart != null || sincePrev != null ? (
          <div className={cn('mt-4 grid gap-2', weighed.length > 2 && 'sm:grid-cols-2')}>
            {sinceStart != null && base ? (
              <div className="rounded-xl bg-surface-elevated/60 px-3 py-2.5">
                <p className="text-sm">
                  <Delta value={sinceStart} unit="kg" dir="neutral" className="text-ink-primary" />
                </p>
                <p className="mt-0.5 text-2xs text-ink-muted">
                  {base.label}
                  {base.iso && lastW ? ` · en ${spanLabel(base.iso, lastW.measured_at)}` : ''}
                </p>
              </div>
            ) : null}
            {sincePrev != null && prevW && prevW !== firstW ? (
              <div className="rounded-xl bg-surface-elevated/60 px-3 py-2.5">
                <p className="text-sm">
                  <Delta value={sincePrev} unit="kg" dir="neutral" className="text-ink-primary" />
                </p>
                <p className="mt-0.5 text-2xs text-ink-muted">
                  desde el control anterior · {spanLabel(prevW.measured_at, lastW.measured_at)}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {chartData.length >= 3 ? (
          <ChartSizedContainer className="mt-4 h-[180px] w-full" minHeight={180}>
            {({ width, height }) => (
              <ResponsiveContainer width={width} height={height}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chartGrid} />
                  <XAxis dataKey="label" {...chartAxis} padding={{ left: 8, right: 16 }} />
                  <YAxis {...chartAxis} domain={['dataMin - 1', 'dataMax + 1']} width={34} tickFormatter={(v: number) => nf(v, 0)} />
                  <Tooltip
                    cursor={chartCursor}
                    content={
                      <ChartTooltip
                        formatValue={(v) => `${nf(v)} kg`}
                        formatLabel={(_l, p) => (p[0]?.payload as { full?: string } | undefined)?.full ?? ''}
                      />
                    }
                  />
                  {base && weighed.length >= 2 ? (
                    <ReferenceLine y={base.w} stroke="rgb(var(--ink-muted))" strokeDasharray="4 4" strokeOpacity={0.6} />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="peso"
                    name="Peso"
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
        ) : weighed.length > 0 ? (
          <p className="mt-3 text-2xs text-ink-muted">
            La curva de evolución aparece a partir del tercer control; mientras tanto, abajo tenés cada control comparado.
          </p>
        ) : null}

        {profile.length ? (
          <p className="mt-4 border-t border-surface-border/60 pt-3 text-2xs text-ink-muted">{profile.join(' · ')}</p>
        ) : null}
      </Card>

      {/* Con una o dos métricas las tarjetas quedan sueltas: ya están en la tabla de controles. */}
      {metrics.length >= 3 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {metrics.map((mt) => {
            const withVal = ordered.filter((m) => mt.get(m, heightCm) != null)
            const v = withVal.length ? mt.get(withVal[withVal.length - 1], heightCm) : null
            const p = withVal.length >= 2 ? mt.get(withVal[withVal.length - 2], heightCm) : null
            return (
              <div key={mt.key} className="rounded-2xl border border-surface-border/80 bg-surface-card px-3.5 py-3">
                <p className="truncate text-3xs font-semibold text-ink-muted">{mt.label}</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-semibold tabular-nums text-ink-primary">{v != null ? nf(v) : '—'}</span>
                  {mt.unit ? <span className="text-2xs text-ink-muted">{mt.unit}</span> : null}
                </p>
                <p className="mt-1 text-2xs">
                  {v != null && p != null ? <Delta value={v - p} unit={mt.unit} dir={mt.dir} /> : <span className="text-ink-muted">un solo control</span>}
                </p>
              </div>
            )
          })}
        </div>
      ) : null}
      {ordered.length && missing.length ? (
        <p className="-mt-1 px-1 text-2xs text-ink-muted">
          Sin datos de {missing.join(', ')}. Aparecen cuando el control incluye pliegues y perímetros.
        </p>
      ) : null}

      {rows.length ? (
        <Card padding="md">
          <div className="mb-2 flex items-center justify-between gap-2">
            <CardTitle>Controles</CardTitle>
            <button type="button" className="text-xs font-medium text-ink-muted hover:text-ink-primary" onClick={() => onGoToTab('antropometria')}>
              Ver todos
            </button>
          </div>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[420px] text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-surface-border/70 text-3xs font-semibold text-ink-muted">
                  <th className="py-2 pr-3 font-semibold">Fecha</th>
                  <th className="py-2 pr-3 text-right font-semibold">Peso</th>
                  <th className="py-2 pr-3 text-right font-semibold">Cambio</th>
                  {metrics.map((mt) => (
                    <th key={mt.key} className="whitespace-nowrap py-2 pr-3 text-right font-semibold last:pr-0">
                      {mt.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const w = weightOf(m)
                  const idx = weighed.indexOf(m)
                  const before = idx > 0 ? weightOf(weighed[idx - 1]) : null
                  return (
                    <tr key={m.id} className="border-b border-surface-border/40 last:border-0">
                      <td className="whitespace-nowrap py-2 pr-3 text-ink-secondary">
                        {format(parseISO(m.measured_at), 'dd/MM/yy')}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-right font-semibold text-ink-primary">{w != null ? `${nf(w)} kg` : '—'}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-right text-2xs">
                        {w != null && before != null ? <Delta value={w - before} unit="" dir="neutral" /> : <span className="text-ink-muted">—</span>}
                      </td>
                      {metrics.map((mt) => {
                        const v = mt.get(m, heightCm)
                        return (
                          <td key={mt.key} className="py-2 pr-3 text-right text-ink-secondary last:pr-0">
                            {v != null ? nf(v) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {latest?.notes ? <p className="mt-3 line-clamp-2 text-2xs text-ink-muted">Nota del último control: {latest.notes}</p> : null}
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Shortcut icon={<Activity />} label="Nuevo control" onClick={() => onGoToTab('antropometria-nuevo')} />
        <Shortcut icon={<Utensils />} label="Editar plan" onClick={() => onGoToTab('plan')} />
        <Shortcut icon={<ClipboardList />} label="Nota clínica" onClick={() => onGoToTab('historia')} />
        <Shortcut icon={<Upload />} label="Subir archivo" onClick={() => onGoToTab('archivos')} />
      </div>
    </div>
  )
}

function Shortcut({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-surface-border/80 bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-surface-border hover:text-ink-primary [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-ink-muted"
    >
      {icon}
      {label}
    </button>
  )
}

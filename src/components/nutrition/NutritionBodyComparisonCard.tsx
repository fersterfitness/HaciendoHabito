import { lazy, Suspense, useMemo, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/Card'
import { controlMdClassName } from '@/lib/formControlClasses'
import { formatDate, cn } from '@/lib/utils'
import type { AnthropometryDetail } from '@/lib/nutrition/anthropometryProgramModel'
import {
  BODY_ZONE_STATUS_LABEL,
  BODY_ZONE_STATUS_ORDER,
  compareBodyZones,
  type BodyZoneId,
  type BodyZoneStatus,
  type MeasureVerdict,
} from '@/lib/nutrition/bodyZoneComparison'
import type { NutritionMeasurement, Student } from '@/types/database'
import { nf } from './NutritionResumenDashboardV2'
import type { BodySex } from './body3d/types'

const BodyViewer = lazy(() => import('./body3d/BodyViewer'))

const CHIP: Record<BodyZoneStatus, string> = {
  good: 'bg-[#22b26b]/12 text-[#1f9d5c] dark:text-[#3fca7f]',
  bad: 'bg-[#e5484d]/12 text-[#d93d42] dark:text-[#f06a6e]',
  alert: 'bg-[#eaa53a]/15 text-[#b07410] dark:text-[#f2b13e]',
  neutral: 'bg-surface-elevated text-ink-secondary',
  same: 'bg-surface-elevated text-ink-muted',
  nodata: 'bg-surface-elevated text-ink-muted',
}
const DELTA: Record<MeasureVerdict, string> = {
  good: 'text-[#1f9d5c] dark:text-[#3fca7f]',
  bad: 'text-[#d93d42] dark:text-[#f06a6e]',
  neutral: 'text-ink-secondary',
  same: 'text-ink-muted',
}
const COUNT = { good: 'text-[#1f9d5c] dark:text-[#3fca7f]', bad: 'text-[#d93d42] dark:text-[#f06a6e]', alert: 'text-[#b07410] dark:text-[#f2b13e]' } as const
const DOT: Record<'good' | 'bad' | 'alert' | 'same', string> = {
  good: 'bg-[#22b26b]',
  bad: 'bg-[#e5484d]',
  alert: 'bg-[#eaa53a]',
  same: 'bg-ink-muted',
}

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${nf(Math.abs(v))}`
const mediansOf = (m: NutritionMeasurement | undefined) => (m?.detail as AnthropometryDetail | null)?.medians ?? null

/** Comparación de dos controles sobre un cuerpo 3D: qué zonas mejoraron y cuáles empeoraron. */
export function NutritionBodyComparisonCard({ student, measurements }: { student: Student; measurements: NutritionMeasurement[] }) {
  const asc = useMemo(() => [...measurements].sort((a, b) => a.measured_at.localeCompare(b.measured_at)), [measurements])
  const lastIdx = asc.length - 1
  const [aId, setAId] = useState<string | null>(null)
  const [bId, setBId] = useState<string | null>(null)
  const a = asc.find((m) => m.id === aId) ?? asc[lastIdx - 1]
  const b = asc.find((m) => m.id === bId) ?? asc[lastIdx]
  const [sex, setSex] = useState<BodySex>(student.gender === 'F' ? 'F' : 'M')
  const [selected, setSelected] = useState<BodyZoneId | null>(null)
  const [spin, setSpin] = useState(true)

  const zones = useMemo(() => compareBodyZones(mediansOf(a), mediansOf(b)), [a, b])
  const status = useMemo(() => Object.fromEntries(zones.map((z) => [z.zone.id, z.status])) as Record<BodyZoneId, BodyZoneStatus>, [zones])
  const sorted = useMemo(() => [...zones].sort((x, y) => BODY_ZONE_STATUS_ORDER[x.status] - BODY_ZONE_STATUS_ORDER[y.status]), [zones])
  const count = (s: BodyZoneStatus) => zones.filter((z) => z.status === s).length

  if (asc.length < 2 || !a || !b) return null
  const label = (m: NutritionMeasurement, i: number) => `N° ${i + 1} · ${formatDate(m.measured_at)}`
  const isPrev = a.id === asc[lastIdx - 1]?.id && b.id === asc[lastIdx]?.id
  const isFirst = a.id === asc[0]?.id && b.id === asc[lastIdx]?.id
  const preset = (from: NutritionMeasurement, to: NutritionMeasurement) => { setAId(from.id); setBId(to.id) }
  const reversed = a.measured_at > b.measured_at

  return (
    <Card padding="md">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Comparar controles</CardTitle>
          <p className="mt-0.5 text-2xs text-ink-muted">Qué zonas mejoraron y cuáles empeoraron entre dos controles.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => preset(asc[lastIdx - 1]!, asc[lastIdx]!)} className={cn('h-7 rounded-md px-2.5 text-xs', isPrev ? 'bg-surface-elevated font-semibold text-ink-primary' : 'text-ink-secondary hover:bg-surface-elevated')}>
            Último vs anterior
          </button>
          {asc.length > 2 ? (
            <button type="button" onClick={() => preset(asc[0]!, asc[lastIdx]!)} className={cn('h-7 rounded-md px-2.5 text-xs', isFirst ? 'bg-surface-elevated font-semibold text-ink-primary' : 'text-ink-secondary hover:bg-surface-elevated')}>
              Último vs primero
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-3xs font-semibold text-ink-muted">
          Desde
          <select value={a.id} onChange={(e) => setAId(e.target.value)} className={cn(controlMdClassName, 'cursor-pointer')}>
            {asc.map((m, i) => <option key={m.id} value={m.id}>{label(m, i)}</option>)}
          </select>
        </label>
        <span className="pb-2.5 text-ink-muted" aria-hidden>→</span>
        <label className="flex min-w-0 flex-col gap-1 text-3xs font-semibold text-ink-muted">
          Hasta
          <select value={b.id} onChange={(e) => setBId(e.target.value)} className={cn(controlMdClassName, 'cursor-pointer')}>
            {asc.map((m, i) => <option key={m.id} value={m.id}>{label(m, i)}</option>)}
          </select>
        </label>
        {reversed ? <p className="pb-2.5 text-2xs text-[#b07410] dark:text-[#f2b13e]">«Desde» es posterior a «Hasta»: los cambios se leen al revés.</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="relative aspect-[4/5] max-h-[620px] w-full overflow-hidden rounded-2xl bg-[#17171b]">
          <Suspense fallback={<span className="absolute inset-0 grid place-items-center text-xs text-ink-muted">Cargando visor…</span>}>
            <BodyViewer sex={sex} status={status} selected={selected} onSelect={setSelected} autoRotate={spin} />
          </Suspense>
          <div className="absolute right-3 top-3 flex gap-1.5">
            <div className="flex rounded-lg bg-black/40 p-0.5 text-2xs backdrop-blur">
              {(['M', 'F'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSex(s)} aria-pressed={sex === s} className={cn('rounded-md px-2 py-1', sex === s ? 'bg-white/90 font-semibold text-black' : 'text-white/70 hover:text-white')}>
                  {s === 'M' ? 'Hombre' : 'Mujer'}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setSpin((v) => !v)} aria-label={spin ? 'Pausar giro' : 'Girar'} className="grid h-7 w-7 place-items-center rounded-lg bg-black/40 text-white/80 backdrop-blur hover:text-white">
              {spin ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap gap-x-3 gap-y-1 text-3xs text-white/70">
            {(['good', 'bad', 'alert', 'same'] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <i className={cn('h-2 w-2 rounded-full', DOT[s])} />
                {s === 'same' ? 'Sin cambio o sin criterio' : BODY_ZONE_STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {([['good', 'mejoraron'], ['bad', 'empeoraron'], ['alert', 'para revisar']] as const).map(([s, txt]) => (
              <div key={s} className="rounded-xl border border-surface-border/80 px-3 py-2">
                <p className={cn('text-xl font-semibold tabular-nums', COUNT[s])}>{count(s)}</p>
                <p className="text-3xs text-ink-muted">zonas {txt}</p>
              </div>
            ))}
          </div>
          <ul className="overflow-hidden rounded-xl border border-surface-border/80">
            {sorted.map((z) => (
              <li key={z.zone.id} className="border-t border-surface-border/60 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setSelected(selected === z.zone.id ? null : z.zone.id)}
                  aria-pressed={selected === z.zone.id}
                  className={cn('grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3.5 py-2.5 text-left hover:bg-surface-elevated/60', selected === z.zone.id && 'bg-surface-elevated shadow-[inset_3px_0_0_rgb(var(--ink-primary))]')}
                >
                  <span className="text-sm font-semibold text-ink-primary">{z.zone.name}</span>
                  <span className={cn('self-start rounded-full px-2 py-0.5 text-3xs font-semibold', CHIP[z.status])}>{BODY_ZONE_STATUS_LABEL[z.status]}</span>
                  {z.rows.length ? (
                    <span className="col-span-2 flex flex-col gap-0.5 text-2xs tabular-nums text-ink-muted">
                      {z.rows.map((r) => (
                        <span key={r.key}>
                          {r.label}: {nf(r.a)} → {nf(r.b)} {r.unit} <span className={cn('font-semibold', DELTA[r.verdict])}>({signed(r.delta)})</span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="col-span-2 text-2xs text-ink-muted">Falta la medida en alguno de los dos controles.</span>
                  )}
                  {z.note ? <span className="col-span-2 text-2xs text-[#b07410] dark:text-[#f2b13e]">{z.note}</span> : null}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-3xs leading-relaxed text-ink-muted">
            Pliegues y cintura: bajar es mejorar. Brazo, antebrazo, muslo y pantorrilla: subir el perímetro es mejorar, salvo que también suba el pliegue de esa zona. Tórax y cadera solo muestran si cambiaron. El cuerpo no cambia de forma, solo de color.
          </p>
        </div>
      </div>
    </Card>
  )
}

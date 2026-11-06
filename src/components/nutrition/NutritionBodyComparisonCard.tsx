import { lazy, Suspense, useMemo, useState } from 'react'
import { UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardTitle } from '@/components/ui/Card'
import { controlMdClassName } from '@/lib/formControlClasses'
import { formatDate, cn } from '@/lib/utils'
import { updateAccessibleStudent } from '@/lib/students/studentAccess'
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
import type { BodySex } from './body2d/zones'

const BodyMap2D = lazy(() => import('./body2d/BodyMap2D'))

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
/** Para «Otro», el cuerpo a mostrar se recuerda en este navegador sin tocar la ficha. */
const modelKey = (id: string) => `hh-body-model:${id}`
function readStoredModel(id: string): BodySex | null {
  try {
    const v = localStorage.getItem(modelKey(id))
    return v === 'M' || v === 'F' ? v : null
  } catch {
    return null
  }
}

export function NutritionBodyComparisonCard({
  student,
  measurements,
  onStudentUpdated,
}: {
  student: Student
  measurements: NutritionMeasurement[]
  onStudentUpdated?: (next: Student) => void
}) {
  const asc = useMemo(() => [...measurements].sort((a, b) => a.measured_at.localeCompare(b.measured_at)), [measurements])
  const lastIdx = asc.length - 1
  const [aId, setAId] = useState<string | null>(null)
  const [bId, setBId] = useState<string | null>(null)
  const a = asc.find((m) => m.id === aId) ?? asc[lastIdx - 1]
  const b = asc.find((m) => m.id === bId) ?? asc[lastIdx]
  const [otherModel, setOtherModel] = useState<BodySex | null>(() => readStoredModel(student.id))
  const [savingSex, setSavingSex] = useState(false)
  // Se carga un solo cuerpo: el que corresponde al sexo de la ficha.
  const sex: BodySex | null = student.gender === 'M' || student.gender === 'F' ? student.gender : student.gender === 'otro' ? otherModel : null

  const chooseSex = async (s: BodySex) => {
    if (student.gender === 'otro') {
      try { localStorage.setItem(modelKey(student.id), s) } catch { /* sin almacenamiento: vale para esta sesión */ }
      setOtherModel(s)
      return
    }
    setSavingSex(true)
    const { error } = await updateAccessibleStudent(student.id, { gender: s })
    setSavingSex(false)
    if (error) {
      toast.error('No se pudo guardar el sexo del paciente. Probá de nuevo o cargalo en Datos personales.')
      return
    }
    toast.success('Sexo guardado en la ficha')
    onStudentUpdated?.({ ...student, gender: s })
  }
  const [selected, setSelected] = useState<BodyZoneId | null>(null)

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
          {sex ? (
            <>
              <Suspense fallback={<span className="absolute inset-0 grid place-items-center text-xs text-white/60">Cargando cuerpo…</span>}>
                <BodyMap2D sex={sex} status={status} selected={selected} onSelect={setSelected} />
              </Suspense>
              {student.gender === 'otro' ? (
                <button type="button" onClick={() => setOtherModel(null)} className="absolute left-3 top-3 h-7 rounded-lg bg-black/45 px-2.5 text-2xs text-white/80 backdrop-blur hover:text-white">
                  Cambiar cuerpo
                </button>
              ) : null}
            </>
          ) : (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80"><UserRound className="h-5 w-5" /></span>
              <p className="text-sm font-semibold text-white">{student.gender === 'otro' ? '¿Qué cuerpo mostramos?' : 'Falta el sexo del paciente'}</p>
              <p className="max-w-[30ch] text-2xs text-white/60">
                {student.gender === 'otro'
                  ? 'En la ficha figura «Otro». Elegí el cuerpo para ver la comparación; no cambia la ficha.'
                  : 'Lo usamos para mostrar el cuerpo que corresponde. Se guarda en la ficha del paciente.'}
              </p>
              <div className="flex gap-2">
                {(['M', 'F'] as const).map((s) => (
                  <button key={s} type="button" disabled={savingSex} onClick={() => void chooseSex(s)} className="h-8 rounded-lg bg-white/90 px-3 text-xs font-semibold text-black hover:bg-white disabled:opacity-60">
                    {s === 'M' ? 'Masculino' : 'Femenino'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={cn('pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap gap-x-3 gap-y-1 text-3xs text-white/70', !sex && 'hidden')}>
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

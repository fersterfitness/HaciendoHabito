import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, BarChart3, Settings2, UserCog, X, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ChartTooltip, chartAxis, chartBarCursor, chartBarRadius, chartGrid } from '@/components/charts/chartKit'
import { controlSmClassName } from '@/lib/formControlClasses'
import { ExerciseVolumeFactorsField } from '@/components/exercises/ExerciseVolumeFactorsField'
import { draftToFactors, factorsToDraft, type FactorsDraft } from '@/lib/volume/factorsDraft'
import { loadPainEvents, painInRange, type PainEvent } from '@/lib/checkIn/painEvents'
import {
  buildSessionVolume,
  computeWeekVolume,
  defaultMuscleFactors,
  MUSCLE_IDS,
  muscleTarget,
  round1,
  TECHNIQUES,
  VOLUME_MUSCLES,
  VOLUME_STATUS_COLOR,
  volumeStatus,
  type SessionVolumeRow,
  type MuscleId,
  type TechniqueId,
  type VolumeContext,
  type VolumeRow,
  type VolumeSettings,
  type VolumeStatus,
  type WeekVolume,
} from '@/lib/volume/trainingVolume'
import {
  deleteVolumeProfile,
  FACTORY_PROFILE,
  loadVolumeData,
  saveRoutineExerciseTechnique,
  saveStudentExerciseFactors,
  saveVolumeProfile,
  VOLUME_SQL_HINT,
  type VolumeData,
  type VolumeProfile,
} from '@/lib/volume/volumeData'
import type { Exercise, RoutineBlock, RoutineDay, RoutineExercise } from '@/types/database'

type Ex = RoutineExercise & { exercise?: Exercise & { muscle_group?: { slug?: string | null } | null } }
type Day = RoutineDay & { exercises: Ex[] }
type Block = RoutineBlock & { days: Day[] }

type Props = {
  open: boolean
  onClose: () => void
  routineName: string
  blocks: Block[]
  /** Recarga la rutina (tras cambiar la técnica de un ejercicio). */
  onRefresh?: () => void | Promise<void>
  /** Alumno de la rutina: permite ajustar el volumen de un ejercicio solo para él y ver sus molestias. */
  studentId?: string | null
  studentName?: string | null
}

const STATUS_COLOR = VOLUME_STATUS_COLOR

const STATUS_LABEL: Record<VolumeStatus, string> = {
  none: 'sin series',
  low: 'por debajo',
  ok: 'en rango',
  high: 'por encima',
}

const STATUS_CELL: Record<VolumeStatus, string> = {
  none: 'text-ink-muted/60',
  low: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  high: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold',
}

const fmt = (n: number | undefined) => (n ? String(round1(n)).replace('.', ',') : '–')

// ─── Gráfico de barras por músculo ───────────────────────────────────────────

function VolumeChart({ week, settings }: { week: WeekVolume; settings: VolumeSettings }) {
  const data = VOLUME_MUSCLES.map((m) => {
    const target = muscleTarget(settings, m.id)
    return {
      label: m.short,
      name: m.label,
      ponderadas: week.weighted[m.id],
      brutas: week.raw[m.id],
      status: volumeStatus(week.weighted[m.id], target),
      target,
    }
  })
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 0 }} barGap={-18}>
        <CartesianGrid {...chartGrid} />
        <ReferenceArea y1={settings.targetMin} y2={settings.targetMax} fill="#10b981" fillOpacity={0.07} stroke="#10b981" strokeOpacity={0.25} strokeDasharray="4 4" />
        <XAxis dataKey="label" {...chartAxis} interval={0} />
        <YAxis {...chartAxis} width={28} allowDecimals={false} />
        <Tooltip
          cursor={chartBarCursor}
          content={
            <ChartTooltip
              formatLabel={(_, p) => String((p[0]?.payload as { name?: string } | undefined)?.name ?? '')}
              formatValue={(v) => `${String(round1(v)).replace('.', ',')} series`}
              footer={(p) => {
                const row = p[0]?.payload as { status: VolumeStatus; target: { min: number; max: number } } | undefined
                return row ? `Rango ${row.target.min}–${row.target.max} · ${STATUS_LABEL[row.status]}` : null
              }}
            />
          }
        />
        <Bar dataKey="brutas" name="Brutas" fill="rgb(var(--ink-muted) / 0.18)" radius={chartBarRadius} maxBarSize={18} />
        <Bar
          dataKey="ponderadas"
          name="Ponderadas"
          radius={chartBarRadius}
          maxBarSize={18}
          label={{ position: 'top', fontSize: 10, fill: 'rgb(var(--ink-secondary))', formatter: (v: unknown) => (Number(v) ? String(round1(Number(v))).replace('.', ',') : '') }}
        >
          {data.map((d) => (
            <Cell key={d.label} fill={STATUS_COLOR[d.status]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Evolución del mesociclo (músculos × semanas) ────────────────────────────

function MesocycleTable({
  weeks,
  labels,
  settings,
  selected,
  onSelect,
}: {
  weeks: WeekVolume[]
  labels: string[]
  settings: VolumeSettings
  selected: number
  onSelect: (i: number) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-0 text-2xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface-card px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-ink-muted">Músculo</th>
            {labels.map((l, i) => (
              <th key={i} className="px-1 py-1.5 text-center">
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className={cn(
                    'rounded-md px-2 py-0.5 font-semibold uppercase tracking-wide transition-colors',
                    i === selected ? 'bg-brand-primary text-white' : 'text-ink-muted hover:bg-surface-elevated hover:text-ink-primary',
                  )}
                >
                  {l}
                </button>
              </th>
            ))}
            <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wide text-ink-muted">Rango</th>
          </tr>
        </thead>
        <tbody>
          {VOLUME_MUSCLES.map((m) => {
            const target = muscleTarget(settings, m.id)
            return (
              <tr key={m.id}>
                <td className="sticky left-0 border-t border-surface-border/60 bg-surface-card px-2 py-1 font-medium text-ink-secondary">{m.label}</td>
                {weeks.map((w, i) => {
                  const v = w.weighted[m.id]
                  const st = volumeStatus(v, target)
                  return (
                    <td key={i} className="border-t border-surface-border/60 px-1 py-1 text-center">
                      <span className={cn('inline-block min-w-[2.6rem] rounded-md px-1.5 py-0.5 tabular-nums', STATUS_CELL[st], i === selected && 'ring-1 ring-brand-primary/50')}>
                        {fmt(v)}
                      </span>
                    </td>
                  )
                })}
                <td className="border-t border-surface-border/60 px-2 py-1 text-center tabular-nums text-ink-muted">
                  {target.min}–{target.max}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Contabilizador (ejercicios × músculos) ─────────────────────────────────

function CounterTable({
  week,
  settings,
  onTechnique,
  savingId,
  studentFactorIds,
  onAdjust,
  studentFirstName,
}: {
  week: WeekVolume
  settings: VolumeSettings
  onTechnique: (row: VolumeRow, technique: TechniqueId | null) => void
  savingId: string | null
  /** Ejercicios con volumen propio de este alumno. */
  studentFactorIds: Set<string>
  /** Ajustar el volumen del ejercicio solo para este alumno. */
  onAdjust?: (row: VolumeRow) => void
  studentFirstName?: string
}) {
  const head = 'px-1.5 py-2 text-center text-3xs font-bold uppercase tracking-wide text-ink-muted'
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border/80">
      <table className="w-full min-w-[1080px] border-collapse text-2xs">
        <thead className="bg-surface-elevated/70">
          <tr>
            <th className={cn(head, 'sticky left-0 z-10 min-w-[12rem] bg-surface-elevated text-left')}>Ejercicio</th>
            <th className={head}>Series</th>
            <th className={cn(head, 'min-w-[9rem]')}>Técnica</th>
            <th className={head}>RIR</th>
            {VOLUME_MUSCLES.map((m) => (
              <th key={m.id} className={head} title={m.label}>
                {m.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {week.days.map((day) => (
            <Fragment key={day.id}>
              <tr>
                <td colSpan={4 + MUSCLE_IDS.length} className="border-t border-surface-border bg-brand-primary/10 px-2 py-1.5 text-3xs font-bold uppercase tracking-widest text-brand-primary">
                  <span className="sticky left-2">
                    {day.name || 'Día'}
                    <span className="ml-2 rounded-full bg-brand-primary/15 px-2 py-0.5 normal-case tracking-normal">
                      {day.totalSets} series en la sesión
                    </span>
                  </span>
                </td>
              </tr>
              {day.rows.length === 0 ? (
                <tr>
                  <td colSpan={4 + MUSCLE_IDS.length} className="border-t border-surface-border/60 px-2 py-2 text-ink-muted">
                    Sin ejercicios.
                  </td>
                </tr>
              ) : null}
              {day.rows.map((r) => {
                const unmapped = !Object.keys(r.factors).length
                const ownStudent = studentFactorIds.has(r.exerciseId)
                return (
                  <tr key={r.routineExerciseId} className="hover:bg-surface-elevated/40">
                    <td className="sticky left-0 z-10 border-t border-surface-border/60 bg-surface-card px-2 py-1.5">
                      <div className="flex items-center gap-1">
                      <a
                        href={`/exercises/${r.exerciseId}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex w-full items-center gap-1.5 text-left font-semibold text-ink-primary"
                        title="Cargar el volumen por músculo en la biblioteca de ejercicios (se abre en otra pestaña)"
                      >
                        <span className="truncate group-hover:underline">{r.name}</span>
                        {unmapped ? <span className="shrink-0 rounded bg-amber-500/15 px-1 text-3xs font-semibold text-amber-600 dark:text-amber-300">asignar</span> : null}
                        {ownStudent ? (
                          <span
                            className="shrink-0 rounded bg-violet-500/15 px-1 text-3xs font-semibold text-violet-700 dark:text-violet-300"
                            title={`Volumen ajustado solo para ${studentFirstName ?? 'este alumno'}`}
                          >
                            {studentFirstName ?? 'alumno'}
                          </span>
                        ) : !unmapped && !r.customFactors ? (
                          <span className="shrink-0 rounded bg-surface-elevated px-1 text-3xs font-medium text-ink-muted" title="Valores sugeridos por el nombre; cargalos en la biblioteca">
                            sugerido
                          </span>
                        ) : null}
                      </a>
                      {onAdjust ? (
                        <button
                          type="button"
                          onClick={() => onAdjust(r)}
                          className={cn(
                            'ml-auto shrink-0 rounded-md p-1 transition-colors hover:bg-surface-elevated hover:text-brand-primary',
                            ownStudent ? 'text-violet-600 dark:text-violet-300' : 'text-ink-muted',
                          )}
                          title={`Ajustar los músculos de este ejercicio solo para ${studentFirstName ?? 'este alumno'} (palancas, estructura)`}
                          aria-label={`Ajustar volumen de ${r.name} para el alumno`}
                        >
                          <UserCog className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      </div>
                    </td>
                    <td className="border-t border-surface-border/60 px-1.5 py-1.5 text-center tabular-nums text-ink-secondary">{r.sets || '–'}</td>
                    <td className="border-t border-surface-border/60 px-1.5 py-1">
                      <div className="flex items-center gap-1">
                        <select
                          value={r.techniqueManual ? r.technique : ''}
                          onChange={(e) => onTechnique(r, (e.target.value || null) as TechniqueId | null)}
                          disabled={savingId === r.routineExerciseId}
                          className={cn(controlSmClassName, 'h-7 w-full min-w-0 px-1.5 text-3xs')}
                          title="Técnica de intensidad (Auto = detectada por método y notas)"
                        >
                          <option value="">Auto · {TECHNIQUES.find((t) => t.id === r.technique)?.label}</option>
                          {TECHNIQUES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label} ×{String(settings.techniques[t.id]).replace('.', ',')}
                            </option>
                          ))}
                        </select>
                        {r.techniqueBlockedByRir ? (
                          <span title={`RIR ${r.rir} > ${settings.rirThreshold}: la técnica no suma (serie lejos del fallo)`}>
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td
                      className={cn('border-t border-surface-border/60 px-1.5 py-1.5 text-center tabular-nums', r.effort < 1 ? 'text-amber-600 dark:text-amber-300' : 'text-ink-secondary')}
                      title={r.effort < 1 ? `RIR ≥ ${settings.farRir}: cuenta ×${settings.farFactor}` : undefined}
                    >
                      {r.rir != null ? String(round1(r.rir)).replace('.', ',') : '–'}
                    </td>
                    {MUSCLE_IDS.map((id) => {
                      const w = r.weighted[id]
                      const raw = r.raw[id]
                      return (
                        <td key={id} className="border-t border-surface-border/60 px-1 py-1.5 text-center tabular-nums">
                          {w ? (
                            <span className={cn(r.factors[id] === 1 ? 'font-semibold text-ink-primary' : 'text-ink-secondary')}>
                              {fmt(w)}
                              {raw && Math.abs(raw - w) > 0.05 ? <span className="ml-0.5 text-3xs text-ink-muted">({fmt(raw)})</span> : null}
                            </span>
                          ) : (
                            <span className="text-ink-muted/40">·</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
        <tfoot className="bg-surface-elevated/70">
          <tr>
            <td colSpan={4} className="sticky left-0 z-10 bg-surface-elevated px-2 py-1.5 text-3xs font-bold uppercase tracking-wide text-ink-muted">
              Series brutas (con sinergias)
            </td>
            {MUSCLE_IDS.map((id) => (
              <td key={id} className="px-1 py-1.5 text-center tabular-nums text-ink-secondary">
                {fmt(week.raw[id])}
              </td>
            ))}
          </tr>
          <tr>
            <td colSpan={4} className="sticky left-0 z-10 bg-surface-elevated px-2 py-1.5 text-3xs font-bold uppercase tracking-wide text-ink-primary">
              Series ponderadas (fatiga real)
            </td>
            {MUSCLE_IDS.map((id) => {
              const st = volumeStatus(week.weighted[id], muscleTarget(settings, id))
              return (
                <td key={id} className="px-1 py-1.5 text-center">
                  <span className={cn('inline-block min-w-[2.4rem] rounded-md px-1 py-0.5 font-semibold tabular-nums', STATUS_CELL[st])}>{fmt(week.weighted[id])}</span>
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Volumen total por sesión ───────────────────────────────────────────────

function SessionTable({
  sessions,
  labels,
  totals,
  selected,
  onSelect,
}: {
  sessions: SessionVolumeRow[]
  labels: string[]
  totals: number[]
  selected: number
  onSelect: (i: number) => void
}) {
  const max = Math.max(1, ...sessions.flatMap((s) => s.perWeek.map((v) => v ?? 0)))
  const cell = (v: number | null, i: number) => (
    <td key={i} className={cn('border-t border-surface-border/60 px-2 py-1.5', i === selected && 'bg-brand-primary/5')}>
      {v == null ? (
        <span className="text-ink-muted/40">–</span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="w-7 text-right font-semibold tabular-nums text-ink-primary">{v}</span>
          <span className="h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-surface-elevated">
            <span className="block h-full rounded-full bg-brand-primary/70" style={{ width: `${(v / max) * 100}%` }} />
          </span>
        </div>
      )}
    </td>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-2xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface-card px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-ink-muted">Sesión</th>
            {labels.map((l, i) => (
              <th key={i} className="px-2 py-1.5 text-left">
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className={cn(
                    'rounded-md px-2 py-0.5 font-semibold uppercase tracking-wide transition-colors',
                    i === selected ? 'bg-brand-primary text-white' : 'text-ink-muted hover:bg-surface-elevated hover:text-ink-primary',
                  )}
                >
                  {l}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.key}>
              <td className="sticky left-0 max-w-[16rem] truncate border-t border-surface-border/60 bg-surface-card px-2 py-1.5 font-medium text-ink-secondary" title={s.name}>
                {s.name}
              </td>
              {s.perWeek.map(cell)}
            </tr>
          ))}
          <tr>
            <td className="sticky left-0 border-t border-surface-border bg-surface-card px-2 py-1.5 font-bold uppercase tracking-wide text-ink-primary">Total semana</td>
            {totals.map((t, i) => (
              <td key={i} className={cn('border-t border-surface-border px-2 py-1.5 font-bold tabular-nums text-ink-primary', i === selected && 'bg-brand-primary/5')}>
                {t} series
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Ajustes / perfiles ──────────────────────────────────────────────────────

function NumField({ label, value, onChange, step = 1, hint }: { label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-2xs font-semibold text-ink-secondary">{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(controlSmClassName, 'w-full')}
      />
      {hint ? <span className="text-3xs leading-snug text-ink-muted">{hint}</span> : null}
    </label>
  )
}

function SettingsModal({
  open,
  profile,
  canDelete,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean
  profile: VolumeProfile
  canDelete: boolean
  onClose: () => void
  onSaved: (id: string) => void
  onDeleted: () => void
}) {
  const [name, setName] = useState(profile.name)
  const [s, setS] = useState<VolumeSettings>(profile.settings)
  const [isDefault, setIsDefault] = useState(profile.is_default)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(profile.name)
    setS(profile.settings)
    setIsDefault(profile.is_default)
  }, [open, profile])

  async function save(asNew: boolean) {
    setSaving(true)
    const { id, error } = await saveVolumeProfile({
      id: asNew ? '' : profile.id,
      name: asNew ? `${name.trim() || 'Perfil'} (copia)` : name,
      settings: s,
      is_default: asNew ? false : isDefault,
    })
    setSaving(false)
    if (error || !id) {
      toast.error(error ?? 'No se pudo guardar')
      return
    }
    toast.success(asNew ? 'Perfil nuevo guardado' : 'Perfil guardado')
    onSaved(id)
  }

  async function remove() {
    const err = await deleteVolumeProfile(profile.id)
    if (err) {
      toast.error(err)
      return
    }
    toast.success('Perfil eliminado')
    onDeleted()
  }

  const setTarget = (id: MuscleId, key: 'min' | 'max', v: string) => {
    setS((prev) => {
      const cur = prev.muscleTargets[id] ?? { min: prev.targetMin, max: prev.targetMax }
      const nextTargets = { ...prev.muscleTargets }
      if (v === '') {
        delete nextTargets[id]
      } else {
        nextTargets[id] = { ...cur, [key]: Number(v) }
      }
      return { ...prev, muscleTargets: nextTargets }
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Contador de volumen"
      title="Ajustes del perfil"
      description="Valores orientativos, no una ley. Guardá un perfil por tipo de alumno (p. ej. principiantes y avanzados)."
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {canDelete ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void remove()} disabled={saving}>
              Eliminar perfil
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void save(true)} disabled={saving}>
              Guardar como nuevo
            </Button>
            <Button type="button" size="sm" loading={saving} onClick={() => void save(false)}>
              Guardar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-semibold text-ink-secondary">Nombre del perfil</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={cn(controlSmClassName, 'w-full')} />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-secondary">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Usar por defecto
          </label>
        </div>

        <section>
          <h4 className="mb-2 text-2xs font-bold uppercase tracking-wider text-ink-muted">Rango objetivo semanal</h4>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Mínimo (series ponderadas)" value={s.targetMin} onChange={(v) => setS({ ...s, targetMin: v })} />
            <NumField label="Máximo (sostenible)" value={s.targetMax} onChange={(v) => setS({ ...s, targetMax: v })} />
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-2xs font-bold uppercase tracking-wider text-ink-muted">Regla de RIR</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumField
              label="Técnicas suman con RIR ≤"
              value={s.rirThreshold}
              onChange={(v) => setS({ ...s, rirThreshold: v })}
              hint="Con un RIR más alto (serie cómoda) el multiplicador no se aplica."
            />
            <NumField label="Lejos del fallo: RIR ≥" value={s.farRir} onChange={(v) => setS({ ...s, farRir: v })} />
            <NumField
              label="…y cuenta como"
              step={0.1}
              value={s.farFactor}
              onChange={(v) => setS({ ...s, farFactor: v })}
              hint="0,5 = media serie efectiva."
            />
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-2xs font-bold uppercase tracking-wider text-ink-muted">Multiplicadores de técnica</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TECHNIQUES.map((t) => (
              <NumField
                key={t.id}
                label={t.label}
                step={0.05}
                value={s.techniques[t.id]}
                onChange={(v) => setS({ ...s, techniques: { ...s.techniques, [t.id]: v } })}
              />
            ))}
          </div>
        </section>

        <section>
          <h4 className="mb-1 text-2xs font-bold uppercase tracking-wider text-ink-muted">Prioridades por músculo</h4>
          <p className="mb-2 text-3xs text-ink-muted">Vacío = usa el rango general. Útil para el mapa muscular objetivo del alumno.</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {VOLUME_MUSCLES.map((m) => {
              const t = s.muscleTargets[m.id]
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-surface-border/70 px-2.5 py-1">
                  <span className="text-xs text-ink-secondary">{m.label}</span>
                  <div className="flex items-center gap-1 text-3xs text-ink-muted">
                    <input
                      type="number"
                      value={t?.min ?? ''}
                      placeholder={String(s.targetMin)}
                      onChange={(e) => setTarget(m.id, 'min', e.target.value)}
                      className={cn(controlSmClassName, 'h-7 w-14 text-center')}
                    />
                    –
                    <input
                      type="number"
                      value={t?.max ?? ''}
                      placeholder={String(s.targetMax)}
                      onChange={(e) => setTarget(m.id, 'max', e.target.value)}
                      className={cn(controlSmClassName, 'h-7 w-14 text-center')}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </Modal>
  )
}

// ─── Volumen de un ejercicio solo para este alumno ──────────────────────────

function StudentFactorsModal({
  row,
  studentId,
  studentFirstName,
  hasOwn,
  base,
  onClose,
  onSaved,
}: {
  row: VolumeRow
  studentId: string
  studentFirstName: string
  hasOwn: boolean
  /** Implicación de la biblioteca (o la sugerida por el nombre). */
  base: Record<string, number>
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<FactorsDraft>(() => factorsToDraft(row.factors))
  const [saving, setSaving] = useState(false)

  async function save(reset: boolean) {
    setSaving(true)
    const err = await saveStudentExerciseFactors(studentId, row.exerciseId, reset ? null : draftToFactors(draft))
    setSaving(false)
    if (err) {
      toast.error(err)
      return
    }
    toast.success(reset ? 'Vuelve a usar el volumen de la biblioteca' : `Volumen ajustado para ${studentFirstName}`)
    onSaved()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      eyebrow={`Solo para ${studentFirstName}`}
      title={row.name}
      description="Por palancas o estructura, en este alumno el ejercicio puede cargar más otros músculos. No cambia la biblioteca ni las rutinas de otros alumnos."
      footer={
        <>
          {hasOwn ? (
            <Button variant="ghost" onClick={() => void save(true)} disabled={saving}>
              Usar la biblioteca
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={saving} onClick={() => void save(false)}>
            Guardar
          </Button>
        </>
      }
    >
      <ExerciseVolumeFactorsField
        value={draft}
        onChange={setDraft}
        suggested={base}
        isSuggestion={false}
        scopeText={`Solo cuenta en las rutinas de ${studentFirstName}.`}
      />
    </Modal>
  )
}

// ─── Panel principal ─────────────────────────────────────────────────────────

/** Contador inteligente de series efectivas por músculo y semana (solo entrenador). */
export function RoutineVolumePanel({ open, onClose, routineName, blocks, onRefresh, studentId = null, studentName = null }: Props) {
  const [data, setData] = useState<VolumeData | null>(null)
  const [pains, setPains] = useState<PainEvent[]>([])
  const [adjusting, setAdjusting] = useState<VolumeRow | null>(null)
  const studentFirstName = studentName?.trim().split(/\s+/)[0] || undefined
  const [profileId, setProfileId] = useState<string>('')
  const [weekIdx, setWeekIdx] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const reload = useCallback(async (selectId?: string) => {
    const [next, painList] = await Promise.all([
      loadVolumeData(studentId),
      studentId ? loadPainEvents(studentId).catch(() => [] as PainEvent[]) : Promise.resolve([] as PainEvent[]),
    ])
    setData(next)
    setPains(painList)
    setProfileId((prev) => {
      const wanted = selectId ?? prev
      if (wanted && next.profiles.some((p) => p.id === wanted)) return wanted
      return (next.profiles.find((p) => p.is_default) ?? next.profiles[0] ?? FACTORY_PROFILE).id
    })
  }, [studentId])

  useEffect(() => {
    if (open) void reload()
  }, [open, reload])

  // Al volver de la biblioteca (otra pestaña), recalcular con los valores nuevos.
  useEffect(() => {
    if (!open) return
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [open, reload])

  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => a.sort_order - b.sort_order), [blocks])
  const profile = data?.profiles.find((p) => p.id === profileId) ?? data?.profiles[0] ?? FACTORY_PROFILE
  const settings = profile.settings

  const ctx: VolumeContext | null = useMemo(
    () => (data ? { settings, factorOverrides: data.factorOverrides, methodNames: data.methodNames } : null),
    [data, settings],
  )
  const weeks = useMemo(
    () => (ctx ? sortedBlocks.map((b) => computeWeekVolume([...b.days].sort((a, c) => a.sort_order - c.sort_order), ctx)) : []),
    [sortedBlocks, ctx],
  )
  const weekPains = useMemo(() => sortedBlocks.map((b) => painInRange(pains, b.start_date, b.end_date)), [sortedBlocks, pains])
  // ⚡ = el alumno reportó una molestia esa semana (check-in).
  const labels = sortedBlocks.map((b, i) => `${b.name?.trim() || `Semana ${i + 1}`}${weekPains[i]?.length ? ' ⚡' : ''}`)
  const groupSlugById = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const b of blocks) for (const d of b.days) for (const e of d.exercises) map.set(e.exercise_id, e.exercise?.muscle_group?.slug ?? null)
    return map
  }, [blocks])
  const safeIdx = Math.min(weekIdx, Math.max(0, weeks.length - 1))
  const week = weeks[safeIdx]

  const sessions = useMemo(() => buildSessionVolume(weeks), [weeks])

  const notesById = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const b of blocks) for (const d of b.days) for (const e of d.exercises) map.set(e.id, e.technical_notes)
    return map
  }, [blocks])

  async function handleTechnique(row: VolumeRow, technique: TechniqueId | null) {
    setSavingId(row.routineExerciseId)
    const { error } = await saveRoutineExerciseTechnique(row.routineExerciseId, notesById.get(row.routineExerciseId) ?? null, technique)
    if (error) toast.error(error)
    else await onRefresh?.()
    setSavingId(null)
  }

  if (!open) return null

  const counts = week
    ? MUSCLE_IDS.reduce(
        (acc, id) => {
          acc[volumeStatus(week.weighted[id], muscleTarget(settings, id))] += 1
          return acc
        },
        { none: 0, low: 0, ok: 0, high: 0 } as Record<VolumeStatus, number>,
      )
    : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-1 backdrop-blur-sm sm:p-3" role="dialog" aria-modal aria-labelledby="volume-panel-title">
      <div className="mx-auto flex h-full w-full max-w-[92rem] flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-base shadow-pop">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-surface-border bg-surface-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-3xs font-semibold uppercase tracking-wider text-brand-primary">Solo entrenador · no PDF ni alumno</p>
            <h2 id="volume-panel-title" className="flex items-center gap-2 truncate text-base font-bold text-ink-primary">
              <BarChart3 className="h-4 w-4 text-brand-primary" />
              Volumen semanal — {routineName}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Series efectivas por músculo con sinergias, técnicas de intensidad y regla de RIR. El mando lo tenés vos.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data ? (
              <select
                value={profile.id}
                onChange={(e) => setProfileId(e.target.value)}
                className={cn(controlSmClassName, 'max-w-[11rem]')}
                title="Perfil de parámetros"
              >
                {data.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.is_default ? ' ★' : ''}
                  </option>
                ))}
              </select>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={() => setSettingsOpen(true)} disabled={!data}>
              <Settings2 className="h-3.5 w-3.5" /> Ajustes
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-border p-2 text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
              aria-label="Cerrar volumen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 sm:p-4">
          {!data ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : !week ? (
            <p className="text-sm text-ink-muted">Agregá semanas y días para ver el volumen.</p>
          ) : (
            <>
              {!data.tablesReady ? (
                <div className="hh-alert hh-alert-warning flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-ink-secondary">
                  <span className="hh-alert-icon h-7 w-7 shrink-0" aria-hidden>
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <span>{VOLUME_SQL_HINT} Mientras tanto se calcula con los valores sugeridos.</span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                  size="sm"
                  items={labels.map((l, i) => ({ id: String(i), label: l }))}
                  value={String(safeIdx)}
                  onChange={(v) => setWeekIdx(Number(v))}
                />
                {counts ? (
                  <div className="flex flex-wrap gap-1.5 text-3xs font-semibold">
                    {(['ok', 'low', 'high'] as const).map((st) => (
                      <span key={st} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1', STATUS_CELL[st])}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[st] }} />
                        {counts[st]} {STATUS_LABEL[st]}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {weekPains[safeIdx]?.length ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-ink-secondary">
                  <span className="mt-0.5 rounded-full bg-amber-400 p-1 text-zinc-900" aria-hidden>
                    <Zap className="h-3 w-3" />
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-ink-primary">
                      {studentFirstName ?? 'El alumno'} reportó {weekPains[safeIdx]!.length === 1 ? 'una molestia' : `${weekPains[safeIdx]!.length} molestias`} esta semana
                    </p>
                    {weekPains[safeIdx]!.map((p) => (
                      <p key={`${p.submittedAt}-${p.date}`}>
                        <span className="tabular-nums">{p.date.slice(8, 10)}/{p.date.slice(5, 7)}</span>
                        {p.approximate ? ' (día del check-in)' : ''} · {p.note || 'sin aclaración'}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {week.unmapped.length ? (
                <div className="hh-alert hh-alert-warning flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-ink-secondary">
                  <span className="hh-alert-icon h-7 w-7 shrink-0" aria-hidden>
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <span>
                    {week.unmapped.length} ejercicio{week.unmapped.length === 1 ? '' : 's'} sin músculo asignado (no suman):{' '}
                    {[...new Set(week.unmapped.map((r) => r.name))].join(', ')}. Tocá el nombre en la tabla para cargar su volumen en la biblioteca.
                  </span>
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
                <section className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink-primary">Volumen de {labels[safeIdx]}</h3>
                    <p className="text-3xs text-ink-muted">
                      Barra de color: ponderadas · gris: brutas · franja verde: rango {settings.targetMin}–{settings.targetMax}
                    </p>
                  </div>
                  <VolumeChart week={week} settings={settings} />
                </section>
                <section className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
                  <h3 className="mb-2 text-sm font-semibold text-ink-primary">Progresión del mesociclo</h3>
                  <MesocycleTable weeks={weeks} labels={labels} settings={settings} selected={safeIdx} onSelect={setWeekIdx} />
                </section>
              </div>

              <section className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink-primary">Volumen total por sesión</h3>
                  <p className="text-3xs text-ink-muted">Suma de todas las series de la sesión (todos los músculos), semana a semana.</p>
                </div>
                <SessionTable sessions={sessions} labels={labels} totals={weeks.map((w) => w.totalSets)} selected={safeIdx} onSelect={setWeekIdx} />
              </section>

              <section className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink-primary">Contabilizador por grupo muscular</h3>
                  <p className="text-3xs text-ink-muted">
                    Valores ponderados (entre paréntesis las brutas si difieren). El volumen de cada ejercicio se carga en la biblioteca: tocá el nombre.
                  </p>
                </div>
                <CounterTable
                  week={week}
                  settings={settings}
                  onTechnique={(r, t) => void handleTechnique(r, t)}
                  savingId={savingId}
                  studentFactorIds={data.studentFactorIds}
                  onAdjust={studentId ? setAdjusting : undefined}
                  studentFirstName={studentFirstName}
                />
              </section>
            </>
          )}
        </div>
      </div>

      {studentId && adjusting && data ? (
        <StudentFactorsModal
          row={adjusting}
          studentId={studentId}
          studentFirstName={studentFirstName ?? 'el alumno'}
          hasOwn={data.studentFactorIds.has(adjusting.exerciseId)}
          base={data.libraryFactors.get(adjusting.exerciseId) ?? defaultMuscleFactors(adjusting.name, groupSlugById.get(adjusting.exerciseId))}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null)
            void reload()
          }}
        />
      ) : null}

      <SettingsModal
        open={settingsOpen}
        profile={profile}
        canDelete={profile.id !== FACTORY_PROFILE.id}
        onClose={() => setSettingsOpen(false)}
        onSaved={(id) => {
          setSettingsOpen(false)
          void reload(id)
        }}
        onDeleted={() => {
          setSettingsOpen(false)
          setProfileId('')
          void reload()
        }}
      />
    </div>
  )
}

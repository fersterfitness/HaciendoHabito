import { cn } from '@/lib/utils'
import { controlMdClassName, controlSmClassName } from '@/lib/formControlClasses'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnthropometryReportDropZone } from './AnthropometryReportDropZone'
import { IS_V2 } from '@/lib/uiVersion'
import { nameScore, type ImportedAnthropometry } from '@/lib/nutrition/anthropometryReportImport'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import type { Json, NutritionMeasurement, Student } from '@/types/database'
import {
  buildAnthropometryMetaDefaults,
  buildBasicAnthroPrefill,
} from '@/lib/nutrition/anthropometryMetaDefaults'
import {
  measurementToFormState,
  nextMeasurementNumber,
  type AnthropometryFormInputs,
} from '@/lib/nutrition/anthropometryFormState'
import {
  ANTHRO_ALL_KEYS,
  ANTHRO_BASIC_KEYS,
  ANTHRO_DIAMETER_KEYS,
  ANTHRO_PERIMETER_KEYS,
  ANTHRO_SKINFOLD_KEYS,
  type AnthropometryDetail,
  type AnthropometryMeta,
  type AnthropometryVariableKey,
  bmiFromKgM,
  computeMediansFromSeries,
  labelForAnthroKey,
  medianOfSeries,
  parseSeries5FromStrings,
  summarizeMediansForNotes,
  type AnthropometrySeriesBlock,
} from '@/lib/nutrition/anthropometryProgramModel'
import toast from 'react-hot-toast'
import { checkAnthroValue, previousControlValues } from '@/lib/nutrition/anthropometryEntryCheck'

/** v2 agrega la columna «Anterior» (mediana del control previo). */
const GRID_COLS = IS_V2
  ? 'grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,0.65fr))_minmax(0,0.55fr)_minmax(0,0.55fr)]'
  : 'grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,0.65fr))_minmax(0,0.55fr)]'

/** Enter baja a la misma serie de la medida siguiente; al terminar la columna sigue con la próxima serie. */
function moveFocus(from: HTMLInputElement, row: number, col: number, back: boolean) {
  const grid = from.closest('[data-anthro-grid]')
  if (!grid) return
  const rows = ANTHRO_ALL_KEYS.length
  let r = row + (back ? -1 : 1)
  let c = col
  if (r >= rows) {
    r = 0
    c += 1
  } else if (r < 0) {
    r = rows - 1
    c -= 1
  }
  if (c < 0 || c > 4) return
  const next = grid.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`)
  next?.focus()
  next?.select()
}

function emptyInputs(): AnthropometryFormInputs {
  const z: [string, string, string, string, string] = ['', '', '', '', '']
  const o = {} as AnthropometryFormInputs
  for (const k of [...ANTHRO_BASIC_KEYS, ...ANTHRO_DIAMETER_KEYS, ...ANTHRO_PERIMETER_KEYS, ...ANTHRO_SKINFOLD_KEYS]) {
    o[k] = [...z]
  }
  return o
}

function inputsWithBasicPrefill(
  prefill: ReturnType<typeof buildBasicAnthroPrefill>,
): AnthropometryFormInputs {
  const base = emptyInputs()
  const put = (key: AnthropometryVariableKey, v: number | null | undefined) => {
    if (v == null || !Number.isFinite(v)) return
    base[key] = [String(v), '', '', '', '']
  }
  put('peso_bruto_kg', prefill.peso_bruto_kg)
  put('talla_corporal_cm', prefill.talla_corporal_cm)
  put('talla_sentado_cm', prefill.talla_sentado_cm)
  return base
}

function numText(v: number | null) {
  return v == null ? '' : String(v).replace('.', ',')
}

function SectionTitle({ children }: { children: string }) {
  return <p className="text-2xs font-semibold text-ink-muted mb-2">{children}</p>
}

function SeriesRow({
  label,
  values,
  onCell,
  fieldKey,
  previous,
}: {
  label: string
  values: [string, string, string, string, string]
  onCell: (idx: number, v: string) => void
  fieldKey: AnthropometryVariableKey
  previous?: number
}) {
  const parsed = useMemo(() => parseSeries5FromStrings(values), [values])
  const median = useMemo(() => medianOfSeries(parsed), [parsed])
  const row = ANTHRO_ALL_KEYS.indexOf(fieldKey)
  return (
    <div className={cn('grid gap-1.5 items-center py-1 border-b border-surface-border/60 last:border-0', GRID_COLS)}>
      <span className="text-2xs text-ink-secondary leading-tight pr-1">{label}</span>
      {values.map((cell, i) => {
        const v = parsed[i]
        const warning =
          IS_V2 && v != null
            ? checkAnthroValue(fieldKey, v, previous, parsed.filter((x, j): x is number => j !== i && x != null))
            : null
        return (
          <input
            key={i}
            type="text"
            inputMode="decimal"
            enterKeyHint="next"
            value={cell}
            data-cell={`${row}-${i}`}
            aria-label={`${label}, serie ${i + 1}`}
            aria-invalid={warning ? true : undefined}
            title={warning ?? undefined}
            onChange={(e) => onCell(i, e.target.value)}
            onKeyDown={(e) => {
              if (!IS_V2 || e.key !== 'Enter') return
              e.preventDefault()
              moveFocus(e.currentTarget, row, i, e.shiftKey)
            }}
            className={cn(
              controlSmClassName,
              'w-full min-w-0 px-1.5 text-2xs',
              warning && 'border-status-pending bg-status-pending/15 font-semibold ring-2 ring-status-pending/30',
            )}
          />
        )
      })}
      <span className="text-right text-2xs font-medium text-brand-secondary tabular-nums">
        {median == null ? '—' : IS_V2 ? String(Math.round(median * 100) / 100).replace('.', ',') : median}
      </span>
      {IS_V2 ? (
        <span className="text-right text-2xs tabular-nums text-ink-muted" title="Mediana del control anterior">
          {previous == null ? '—' : String(previous).replace('.', ',')}
        </span>
      ) : null}
    </div>
  )
}

export type AnthropometryProgramDraft =
  | { mode: 'edit'; measurementId: string }
  | { mode: 'clone'; measurementId: string }
  | null

export function NutritionAnthropometryProgramForm({
  ownerId,
  student,
  measurements,
  draft,
  onDraftClear,
  onSaved,
  importFile,
  onImportConsumed,
}: {
  ownerId: string
  student: Student
  measurements: NutritionMeasurement[]
  draft?: AnthropometryProgramDraft
  onDraftClear?: () => void
  onSaved: () => void | Promise<void>
  /** Informe arrastrado en otra pantalla (Antropometría): se importa al abrir la ficha. */
  importFile?: File | null
  onImportConsumed?: () => void
}) {
  const studentId = student.id

  const measurementsSeed = useMemo(() => {
    const sorted = [...measurements].sort(
      (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
    )
    const last = sorted[0]
    return `${measurements.length}:${last?.id ?? ''}:${last?.measured_at ?? ''}`
  }, [measurements])

  const defaults = useMemo(
    () => ({
      meta: buildAnthropometryMetaDefaults(student, measurements),
      inputs: inputsWithBasicPrefill(buildBasicAnthroPrefill(student, measurements)),
    }),
    [student, measurements, measurementsSeed],
  )

  const [inputs, setInputs] = useState(defaults.inputs)
  const [meta, setMeta] = useState<AnthropometryMeta>(defaults.meta)
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  /** % grasa y masa muscular (v2): vienen del informe importado o se cargan a mano. */
  const [fatPct, setFatPct] = useState('')
  const [muscleKg, setMuscleKg] = useState('')
  const [imported, setImported] = useState<(ImportedAnthropometry & { fileName: string }) | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    setImported(null)
    setImportError(null)
    if (!draft) {
      setMeta(defaults.meta)
      setInputs(defaults.inputs)
      setMeasuredAt(new Date().toISOString().slice(0, 10))
      setFatPct('')
      setMuscleKg('')
      return
    }
    const source = measurements.find((m) => m.id === draft.measurementId)
    if (!source) return
    const loaded = measurementToFormState(source)
    setInputs(loaded.inputs)
    setFatPct(numText(source.body_fat_pct))
    setMuscleKg(numText(source.muscle_mass_kg))
    if (draft.mode === 'clone') {
      setMeasuredAt(new Date().toISOString().slice(0, 10))
      setMeta({
        ...loaded.meta,
        measurement_number: nextMeasurementNumber(measurements),
      })
    } else {
      setMeasuredAt(loaded.measuredAt)
      setMeta(loaded.meta)
    }
  }, [draft, defaults, measurements])

  const previous = useMemo(
    () => (IS_V2 ? previousControlValues(measurements, draft?.mode === 'edit' ? draft.measurementId : null) : {}),
    [measurements, draft],
  )
  /** Valores marcados, para el aviso de antes de guardar. */
  const warnings = useMemo(() => {
    if (!IS_V2) return []
    const out: { key: AnthropometryVariableKey; msg: string }[] = []
    for (const k of ANTHRO_ALL_KEYS) {
      const p = parseSeries5FromStrings(inputs[k])
      for (let i = 0; i < 5; i++) {
        const v = p[i]
        if (v == null) continue
        const msg = checkAnthroValue(k, v, previous[k], p.filter((x, j): x is number => j !== i && x != null))
        if (msg) {
          out.push({ key: k, msg: `${labelForAnthroKey(k)}${p.filter((x) => x != null).length > 1 ? ` (serie ${i + 1})` : ''}: ${msg.charAt(0).toLowerCase()}${msg.slice(1)}` })
        }
      }
    }
    return out
  }, [inputs, previous])

  const consumedRef = useRef<File | null>(null)
  useEffect(() => {
    if (!IS_V2 || !importFile || consumedRef.current === importFile) return
    consumedRef.current = importFile
    onImportConsumed?.()
    void importReport(importFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo cuando llega un archivo nuevo
  }, [importFile])

  function setCell(key: AnthropometryVariableKey, idx: number, v: string) {
    setInputs((prev) => {
      const row = [...prev[key]] as [string, string, string, string, string]
      row[idx] = v
      return { ...prev, [key]: row }
    })
  }

  async function importReport(file: File) {
    const fail = (msg: string) => {
      setImportError(msg)
      setImported(null)
      toast.error(msg, { duration: 6000 })
    }
    setImportError(null)
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      fail(`"${file.name}" no es un PDF. Arrastrá el informe de composición corporal en PDF.`)
      return
    }
    setImporting(true)
    try {
      const { readAnthropometryReportPdf } = await import('@/lib/nutrition/anthropometryReportPdf')
      const r = await readAnthropometryReportPdf(file)
      const found = Object.keys(r.values).length
      if (found < 3) {
        fail(`"${file.name}" no tiene el formato del informe de composición corporal: no encontré las medidas (peso, perímetros, pliegues).`)
        return
      }
      if (r.measuredAt) {
        const month = r.measuredAt.slice(0, 7)
        const clash = measurements.find(
          (m) => m.measured_at.slice(0, 7) === month && !(draft?.mode === 'edit' && m.id === draft.measurementId),
        )
        if (clash) {
          const [y, mo] = month.split('-')
          const monthName = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
          fail(
            `Ya hay un control de ${monthName} (${clash.measured_at.slice(0, 10).split('-').reverse().join('/')}). No se importó: editá o borrá ese control si querés reemplazarlo.`,
          )
          return
        }
      }
      setInputs((prev) => {
        const next = { ...prev }
        for (const [k, v] of Object.entries(r.values)) {
          next[k as AnthropometryVariableKey] = [numText(v), '', '', '', '']
        }
        return next
      })
      if (r.measuredAt) setMeasuredAt(r.measuredAt)
      if (r.measurementNumber != null) setMeta((m) => ({ ...m, measurement_number: r.measurementNumber ?? undefined }))
      if (r.bodyFatPct != null) setFatPct(numText(r.bodyFatPct))
      if (r.muscleMassKg != null) setMuscleKg(numText(r.muscleMassKg))
      setImported({ ...r, fileName: file.name })
      toast.success(`${found} medidas cargadas del informe. Revisá y guardá.`)
    } catch {
      fail(`No pude leer "${file.name}". Puede estar dañado o protegido con contraseña.`)
    } finally {
      setImporting(false)
    }
  }

  function blockToSeries(blockKeys: readonly AnthropometryVariableKey[]): AnthropometrySeriesBlock {
    const block: AnthropometrySeriesBlock = {}
    for (const k of blockKeys) {
      block[k] = parseSeries5FromStrings(inputs[k])
    }
    return block
  }

  async function handleSave() {
    const series: AnthropometrySeriesBlock = {
      ...blockToSeries(ANTHRO_BASIC_KEYS),
      ...blockToSeries(ANTHRO_DIAMETER_KEYS),
      ...blockToSeries(ANTHRO_PERIMETER_KEYS),
      ...blockToSeries(ANTHRO_SKINFOLD_KEYS),
    }
    const medians = computeMediansFromSeries(series)
    const weight = medians.peso_bruto_kg ?? null
    const heightCm = medians.talla_corporal_cm ?? null
    const sitting = medians.talla_sentado_cm ?? null
    const heightM = heightCm != null ? heightCm / 100 : null
    const bmi = bmiFromKgM(weight, heightM)
    const { perimeters, skinfolds } = summarizeMediansForNotes(medians)

    const detail: AnthropometryDetail = {
      meta: {
        ...meta,
        measurement_number: meta.measurement_number,
      },
      series,
      medians,
    }
    // Al editar se conservan los textos del informe ilustrado guardados en el control.
    if (draft?.mode === 'edit') {
      const prevDetail = measurements.find((m) => m.id === draft.measurementId)?.detail as { report?: unknown } | null | undefined
      if (prevDetail && typeof prevDetail === 'object' && prevDetail.report) (detail as { report?: unknown }).report = prevDetail.report
    }

    const row = {
      measured_at: measuredAt,
      measurement_number: meta.measurement_number ?? null,
      weight_kg: weight,
      height_cm: heightCm,
      sitting_height_cm: sitting,
      bmi,
      body_fat_pct: IS_V2 ? parseSeries5FromStrings([fatPct, '', '', '', ''])[0] : null,
      muscle_mass_kg: IS_V2 ? parseSeries5FromStrings([muscleKg, '', '', '', ''])[0] : null,
      perimeters_notes: perimeters || null,
      skinfolds_notes: skinfolds || null,
      notes: null,
      detail: detail as unknown as Json,
    }

    setSaving(true)
    let error: { message: string } | null = null
    if (draft?.mode === 'edit') {
      const res = await supabase
        .from('nutrition_measurements')
        .update(row)
        .eq('id', draft.measurementId)
        .eq('owner_id', ownerId)
        .eq('student_id', studentId)
      error = res.error
    } else {
      const res = await supabase.from('nutrition_measurements').insert({
        owner_id: ownerId,
        student_id: studentId,
        ...row,
      })
      error = res.error
    }
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(
      draft?.mode === 'edit'
        ? 'Control actualizado'
        : draft?.mode === 'clone'
          ? 'Control clonado y guardado'
          : 'Medición del programa guardada',
    )
    onDraftClear?.()
    await onSaved()
  }

  const draftLabel =
    draft?.mode === 'edit'
      ? 'Editando control seleccionado'
      : draft?.mode === 'clone'
        ? 'Clonando control — se guardará como medición nueva'
        : null

  return (
    <div className="space-y-5">
      {draftLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-secondary/30 bg-brand-secondary/10 px-3 py-2">
          <p className="text-xs font-medium text-brand-secondary">{draftLabel}</p>
          <button
            type="button"
            onClick={() => onDraftClear?.()}
            className="text-xs font-medium text-ink-muted hover:text-ink-primary underline-offset-2 hover:underline"
          >
            Cancelar
          </button>
        </div>
      ) : null}

      {IS_V2 ? (
        <div>
          <AnthropometryReportDropZone
            busy={importing}
            onFile={(f) => void importReport(f)}
            error={importError}
            hint="Arrastrá el informe de composición corporal o tocá para elegirlo. Completa las medidas, la fecha, el N°, % grasa y masa muscular."
          />

          {imported ? (
            <div className="mt-2 rounded-xl bg-surface-elevated/60 px-3 py-2.5 text-2xs text-ink-secondary">
              <p>
                <span className="font-semibold text-ink-primary">{25 - imported.missing.length} de 25 medidas</span> cargadas de {imported.fileName}
                {imported.measuredAt ? ` · fecha ${imported.measuredAt.split('-').reverse().join('/')}` : ''}
                {imported.measurementNumber != null ? ` · N° ${imported.measurementNumber}` : ''}. Revisá y guardá.
              </p>
              {imported.missing.length ? (
                <p className="mt-1 text-ink-muted">No estaban en el informe: {imported.missing.map((k) => labelForAnthroKey(k)).join(', ')}.</p>
              ) : null}
              {imported.patientName && nameScore(imported.patientName, student.full_name) === 0 ? (
                <p className="mt-1 font-medium text-status-expired">
                  Ojo: el informe es de {imported.patientName}, no de {student.full_name}.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-surface-border bg-surface-elevated/40 p-3 space-y-3">
        <SectionTitle>Datos generales (como en el Excel)</SectionTitle>
        <p className="text-3xs text-ink-muted leading-relaxed -mt-1">
          Se completan desde la ficha del paciente, el registro web o la última medición. Podés editarlos si hace falta.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-2xs text-ink-secondary">
            Fecha de medición
            <input
              type="date"
              value={measuredAt}
              onChange={(e) => setMeasuredAt(e.target.value)}
              className={cn(controlMdClassName, 'mt-1 w-full px-2')}
            />
          </label>
          <label className="text-2xs text-ink-secondary">
            N° medición
            <input
              type="number"
              min={1}
              value={meta.measurement_number ?? ''}
              onChange={(e) =>
                setMeta((m) => ({
                  ...m,
                  measurement_number: e.target.value ? Number.parseInt(e.target.value, 10) : undefined,
                }))
              }
              placeholder="Ej. 2"
              className={cn(controlMdClassName, 'mt-1 w-full px-2')}
            />
          </label>
          <label className="text-2xs text-ink-secondary">
            Sexo (programa: 1=m · 2=f)
            <select
              value={meta.sex == null ? '' : String(meta.sex)}
              onChange={(e) => {
                const v = e.target.value
                setMeta((m) => ({ ...m, sex: v === '1' ? 1 : v === '2' ? 2 : null }))
              }}
              className={cn(controlMdClassName, 'mt-1 w-full px-2 cursor-pointer')}
            >
              <option value="">—</option>
              <option value="1">1 · Masculino</option>
              <option value="2">2 · Femenino</option>
            </select>
          </label>
          <label className="text-2xs text-ink-secondary sm:col-span-2">
            Deporte
            <input
              value={meta.sport ?? ''}
              onChange={(e) => setMeta((m) => ({ ...m, sport: e.target.value }))}
              className={cn(controlMdClassName, 'mt-1 w-full px-2')}
            />
          </label>
          <label className="text-2xs text-ink-secondary">
            Act. física
            <input
              value={meta.physical_activity ?? ''}
              onChange={(e) => setMeta((m) => ({ ...m, physical_activity: e.target.value }))}
              className={cn(controlMdClassName, 'mt-1 w-full px-2')}
            />
          </label>
          <label className="text-2xs text-ink-secondary">
            Depo/Recrea (D/R)
            <input
              value={meta.depo_recrea ?? ''}
              onChange={(e) => setMeta((m) => ({ ...m, depo_recrea: e.target.value }))}
              className={cn(controlMdClassName, 'mt-1 w-full px-2')}
            />
          </label>
          {IS_V2 ? (
            <>
              <label className="text-2xs text-ink-secondary">
                % grasa (masa adiposa)
                <input
                  type="text"
                  inputMode="decimal"
                  value={fatPct}
                  onChange={(e) => setFatPct(e.target.value)}
                  placeholder="Ej. 20,87"
                  className={cn(controlMdClassName, 'mt-1 w-full px-2')}
                />
              </label>
              <label className="text-2xs text-ink-secondary">
                Masa muscular (kg)
                <input
                  type="text"
                  inputMode="decimal"
                  value={muscleKg}
                  onChange={(e) => setMuscleKg(e.target.value)}
                  placeholder="Ej. 49,2"
                  className={cn(controlMdClassName, 'mt-1 w-full px-2')}
                />
              </label>
            </>
          ) : null}
          <label className="text-2xs text-ink-secondary lg:col-span-2">
            % error técnico TE (diámetros/pliegues)
            <div className="mt-1 flex items-center gap-2.5">
              <div className="relative w-[5.5rem] shrink-0">
                <input
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  value={meta.measurement_error_pct_default ?? 2}
                  onChange={(e) => {
                    const raw = Number.parseFloat(e.target.value)
                    const n = Number.isFinite(raw) ? Math.min(15, Math.max(0, raw)) : 2
                    setMeta((m) => ({ ...m, measurement_error_pct_default: n }))
                  }}
                  className={cn(controlMdClassName, 'w-full px-2.5 pr-7 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
                  %
                </span>
              </div>
              <span className="text-3xs leading-snug text-ink-muted">
                Por defecto 2% (como en el Excel). Usado en valor ajustado y PDF.
              </span>
            </div>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <div data-anthro-grid className={cn('p-3 bg-surface-card/80', IS_V2 ? 'min-w-[780px]' : 'min-w-[720px]')}>
          {IS_V2 ? (
            <p className="mb-2 text-3xs text-ink-muted">
              Enter pasa a la medida de abajo (Shift + Enter, a la de arriba). Los valores raros se marcan en amarillo.
            </p>
          ) : null}
          <div className={cn('grid gap-1.5 items-end pb-2 mb-2 border-b border-surface-border', GRID_COLS)}>
            <span className="text-3xs font-semibold uppercase text-ink-muted">Variable</span>
            <span className="text-3xs font-semibold text-center text-ink-muted">Serie 1</span>
            <span className="text-3xs font-semibold text-center text-ink-muted">Serie 2</span>
            <span className="text-3xs font-semibold text-center text-ink-muted">Serie 3</span>
            <span className="text-3xs font-semibold text-center text-ink-muted">Serie 4</span>
            <span className="text-3xs font-semibold text-center text-ink-muted">Serie 5</span>
            <span className="text-3xs font-semibold text-right text-ink-muted">Mediana</span>
            {IS_V2 ? <span className="text-3xs font-semibold text-right text-ink-muted">Anterior</span> : null}
          </div>

          <SectionTitle>Datos básicos</SectionTitle>
          {ANTHRO_BASIC_KEYS.map((k) => (
            <SeriesRow key={k} fieldKey={k} previous={previous[k]} label={labelForAnthroKey(k)} values={inputs[k]} onCell={(i, v) => setCell(k, i, v)} />
          ))}

          <div className="h-3" />
          <SectionTitle>Diámetros (cm)</SectionTitle>
          {ANTHRO_DIAMETER_KEYS.map((k) => (
            <SeriesRow key={k} fieldKey={k} previous={previous[k]} label={labelForAnthroKey(k)} values={inputs[k]} onCell={(i, v) => setCell(k, i, v)} />
          ))}

          <div className="h-3" />
          <SectionTitle>Perímetros (cm)</SectionTitle>
          {ANTHRO_PERIMETER_KEYS.map((k) => (
            <SeriesRow key={k} fieldKey={k} previous={previous[k]} label={labelForAnthroKey(k)} values={inputs[k]} onCell={(i, v) => setCell(k, i, v)} />
          ))}

          <div className="h-3" />
          <SectionTitle>Pliegues cutáneos (mm)</SectionTitle>
          {ANTHRO_SKINFOLD_KEYS.map((k) => (
            <SeriesRow key={k} fieldKey={k} previous={previous[k]} label={labelForAnthroKey(k)} values={inputs[k]} onCell={(i, v) => setCell(k, i, v)} />
          ))}
        </div>
      </div>

      <p className="text-2xs text-ink-muted leading-relaxed">
        Las medianas se calculan con los valores ingresados (vacíos se ignoran). Peso, talla y talla sentado alimentan también
        los campos resumen e IMC. Podés complementar con la sección de mediciones rápidas si usás % grasa o masa muscular de
        otro método.
      </p>

      {warnings.length ? (
        <div role="status" className="rounded-xl border border-status-pending/40 bg-status-pending/10 px-3 py-2.5 text-2xs text-ink-secondary">
          <p className="font-semibold text-ink-primary">
            {warnings.length === 1 ? 'Hay un valor para revisar' : `Hay ${warnings.length} valores para revisar`} antes de guardar
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {warnings.slice(0, 6).map((w, i) => (
              <li key={i}>{w.msg}</li>
            ))}
          </ul>
          {warnings.length > 6 ? <p className="mt-1 text-ink-muted">y {warnings.length - 6} más, marcados en la tabla.</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="gradientSecondary"
          onClick={() => void handleSave()}
          loading={saving}
        >
          {draft?.mode === 'edit'
            ? 'Guardar cambios'
            : draft?.mode === 'clone'
              ? 'Guardar clon'
              : 'Guardar control del programa'}
        </Button>
        {draft ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onDraftClear?.()} disabled={saving}>
            Descartar
          </Button>
        ) : null}
      </div>
    </div>
  )
}

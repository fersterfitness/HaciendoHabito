import { useEffect, useMemo, useState } from 'react'
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

function SectionTitle({ children }: { children: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">{children}</p>
}

function SeriesRow({
  label,
  values,
  onCell,
}: {
  label: string
  values: [string, string, string, string, string]
  onCell: (idx: number, v: string) => void
}) {
  const median = useMemo(() => medianOfSeries(parseSeries5FromStrings(values)), [values])
  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,0.65fr))_minmax(0,0.55fr)] gap-1.5 items-center py-1 border-b border-surface-border/60 last:border-0">
      <span className="text-[11px] text-ink-secondary leading-tight pr-1">{label}</span>
      {values.map((cell, i) => (
        <input
          key={i}
          type="text"
          inputMode="decimal"
          value={cell}
          onChange={(e) => onCell(i, e.target.value)}
          className="w-full min-w-0 rounded-lg border border-surface-inputBorder bg-surface-input px-1.5 py-1 text-[11px] text-ink-primary"
        />
      ))}
      <span className="text-right text-[11px] font-medium text-brand-secondary tabular-nums">
        {median == null ? '—' : median}
      </span>
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
}: {
  ownerId: string
  student: Student
  measurements: NutritionMeasurement[]
  draft?: AnthropometryProgramDraft
  onDraftClear?: () => void
  onSaved: () => void | Promise<void>
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

  useEffect(() => {
    if (!draft) {
      setMeta(defaults.meta)
      setInputs(defaults.inputs)
      setMeasuredAt(new Date().toISOString().slice(0, 10))
      return
    }
    const source = measurements.find((m) => m.id === draft.measurementId)
    if (!source) return
    const loaded = measurementToFormState(source)
    setInputs(loaded.inputs)
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

  function setCell(key: AnthropometryVariableKey, idx: number, v: string) {
    setInputs((prev) => {
      const row = [...prev[key]] as [string, string, string, string, string]
      row[idx] = v
      return { ...prev, [key]: row }
    })
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

    const row = {
      measured_at: measuredAt,
      measurement_number: meta.measurement_number ?? null,
      weight_kg: weight,
      height_cm: heightCm,
      sitting_height_cm: sitting,
      bmi,
      body_fat_pct: null,
      muscle_mass_kg: null,
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

      <div className="rounded-xl border border-surface-border bg-surface-elevated/40 p-3 space-y-3">
        <SectionTitle>Datos generales (como en el Excel)</SectionTitle>
        <p className="text-[10px] text-ink-muted leading-relaxed -mt-1">
          Se completan desde la ficha del paciente, el registro web o la última medición. Podés editarlos si hace falta.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-[11px] text-ink-secondary">
            Fecha de medición
            <input
              type="date"
              value={measuredAt}
              onChange={(e) => setMeasuredAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-2 py-2 text-sm"
            />
          </label>
          <label className="text-[11px] text-ink-secondary">
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
              className="mt-1 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-2 py-2 text-sm"
            />
          </label>
          <label className="text-[11px] text-ink-secondary">
            Sexo (programa: 1=m · 2=f)
            <select
              value={meta.sex == null ? '' : String(meta.sex)}
              onChange={(e) => {
                const v = e.target.value
                setMeta((m) => ({ ...m, sex: v === '1' ? 1 : v === '2' ? 2 : null }))
              }}
              className="mt-1 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-2 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="1">1 · Masculino</option>
              <option value="2">2 · Femenino</option>
            </select>
          </label>
          <label className="text-[11px] text-ink-secondary sm:col-span-2">
            Deporte
            <input
              value={meta.sport ?? ''}
              onChange={(e) => setMeta((m) => ({ ...m, sport: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-2 py-2 text-sm"
            />
          </label>
          <label className="text-[11px] text-ink-secondary">
            Act. física
            <input
              value={meta.physical_activity ?? ''}
              onChange={(e) => setMeta((m) => ({ ...m, physical_activity: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-2 py-2 text-sm"
            />
          </label>
          <label className="text-[11px] text-ink-secondary">
            Depo/Recrea (D/R)
            <input
              value={meta.depo_recrea ?? ''}
              onChange={(e) => setMeta((m) => ({ ...m, depo_recrea: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-2 py-2 text-sm"
            />
          </label>
          <label className="text-[11px] text-ink-secondary">
            % error técnico TE (diámetros/pliegues)
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
              className="mt-1 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-2 py-2 text-sm"
            />
            <span className="block text-[10px] text-ink-muted mt-0.5">Por defecto 2% (como en el Excel). Usado en valor ajustado y PDF.</span>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <div className="min-w-[720px] p-3 bg-surface-card/80">
          <div className="grid grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,0.65fr))_minmax(0,0.55fr)] gap-1.5 items-end pb-2 mb-2 border-b border-surface-border">
            <span className="text-[10px] font-semibold uppercase text-ink-muted">Variable</span>
            <span className="text-[10px] font-semibold text-center text-ink-muted">Serie 1</span>
            <span className="text-[10px] font-semibold text-center text-ink-muted">Serie 2</span>
            <span className="text-[10px] font-semibold text-center text-ink-muted">Serie 3</span>
            <span className="text-[10px] font-semibold text-center text-ink-muted">Serie 4</span>
            <span className="text-[10px] font-semibold text-center text-ink-muted">Serie 5</span>
            <span className="text-[10px] font-semibold text-right text-ink-muted">Mediana</span>
          </div>

          <SectionTitle>Datos básicos</SectionTitle>
          {ANTHRO_BASIC_KEYS.map((k) => (
            <SeriesRow key={k} label={labelForAnthroKey(k)} values={inputs[k]} onCell={(i, v) => setCell(k, i, v)} />
          ))}

          <div className="h-3" />
          <SectionTitle>Diámetros (cm)</SectionTitle>
          {ANTHRO_DIAMETER_KEYS.map((k) => (
            <SeriesRow key={k} label={labelForAnthroKey(k)} values={inputs[k]} onCell={(i, v) => setCell(k, i, v)} />
          ))}

          <div className="h-3" />
          <SectionTitle>Perímetros (cm)</SectionTitle>
          {ANTHRO_PERIMETER_KEYS.map((k) => (
            <SeriesRow key={k} label={labelForAnthroKey(k)} values={inputs[k]} onCell={(i, v) => setCell(k, i, v)} />
          ))}

          <div className="h-3" />
          <SectionTitle>Pliegues cutáneos (mm)</SectionTitle>
          {ANTHRO_SKINFOLD_KEYS.map((k) => (
            <SeriesRow key={k} label={labelForAnthroKey(k)} values={inputs[k]} onCell={(i, v) => setCell(k, i, v)} />
          ))}
        </div>
      </div>

      <p className="text-[11px] text-ink-muted leading-relaxed">
        Las medianas se calculan con los valores ingresados (vacíos se ignoran). Peso, talla y talla sentado alimentan también
        los campos resumen e IMC. Podés complementar con la sección de mediciones rápidas si usás % grasa o masa muscular de
        otro método.
      </p>

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

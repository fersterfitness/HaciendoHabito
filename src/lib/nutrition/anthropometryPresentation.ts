import type { NutritionMeasurement } from '@/types/database'
import {
  ANTHRO_DIAMETER_KEYS,
  ANTHRO_PERIMETER_KEYS,
  ANTHRO_SKINFOLD_KEYS,
  bmiFromKgM,
  type AnthropometryDetail,
  type AnthropometryMedians,
  type AnthropometryVariableKey,
  labelForAnthroKey,
} from '@/lib/nutrition/anthropometryProgramModel'

/** Orden y agrupación alineados a la solapa «Presentación» del Excel. */
export const PRESENTATION_SECTIONS: {
  sectionTitle: string
  rows: { label: string; key: AnthropometryVariableKey }[]
}[] = [
  {
    sectionTitle: 'BÁSICOS',
    rows: [
      { label: 'Peso (kg)', key: 'peso_bruto_kg' },
      { label: 'Talla (cm)', key: 'talla_corporal_cm' },
      { label: 'Talla sentado (cm)', key: 'talla_sentado_cm' },
    ],
  },
  {
    sectionTitle: 'DIÁMETROS (cm)',
    rows: ANTHRO_DIAMETER_KEYS.map((key) => ({ label: labelForAnthroKey(key), key })),
  },
  {
    sectionTitle: 'PERÍMETROS (cm)',
    rows: ANTHRO_PERIMETER_KEYS.map((key) => ({ label: labelForAnthroKey(key), key })),
  },
  {
    sectionTitle: 'PLIEGUES CUTÁNEOS (mm)',
    rows: ANTHRO_SKINFOLD_KEYS.map((key) => ({ label: labelForAnthroKey(key), key })),
  },
]

function detailOf(m: NutritionMeasurement): AnthropometryDetail | null {
  const d = m.detail
  if (!d || typeof d !== 'object') return null
  return d as AnthropometryDetail
}

/** Une medianas del programa con columnas resumen de la fila SQL. */
export function mergedMediansForPresentation(m: NutritionMeasurement): AnthropometryMedians {
  const med = { ...(detailOf(m)?.medians ?? {}) } as AnthropometryMedians
  if (med.peso_bruto_kg == null && m.weight_kg != null) med.peso_bruto_kg = m.weight_kg
  if (med.talla_corporal_cm == null && m.height_cm != null) med.talla_corporal_cm = m.height_cm
  if (med.talla_sentado_cm == null && m.sitting_height_cm != null) med.talla_sentado_cm = m.sitting_height_cm
  return med
}

/**
 * Corrección por error técnico de medición (ISAK orientativo): diámetros y pliegues.
 * Valor ajustado = mediana / (1 − TE/100). Básicos y perímetros se dejan = mediana.
 */
export function adjustedValueForPresentation(
  key: AnthropometryVariableKey,
  median: number | null,
  technicalErrorPct: number | null | undefined,
): number | null {
  if (median == null || !Number.isFinite(median)) return null
  const te = technicalErrorPct ?? 2
  if (!Number.isFinite(te) || te <= 0 || te >= 99) return median
  const factor = 1 - te / 100
  const useCorrection =
    (ANTHRO_DIAMETER_KEYS as readonly string[]).includes(key) || (ANTHRO_SKINFOLD_KEYS as readonly string[]).includes(key)
  if (!useCorrection) return Math.round(median * 100) / 100
  return Math.round((median / factor) * 1000) / 1000
}

function fmt(n: number | null, decimals: number): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return Number(n.toFixed(decimals)).toString()
}

function decimalsForKey(key: AnthropometryVariableKey): number {
  if (key === 'peso_bruto_kg') return 2
  if (key.endsWith('_mm')) return 1
  return 1
}

function unitForKey(key: AnthropometryVariableKey): string {
  if (key.endsWith('_mm')) return 'mm'
  if (key === 'peso_bruto_kg') return 'kg'
  return 'cm'
}

export type PresentationRow = {
  /** Clave estable para listas y PDF. */
  rowId: string
  sectionTitle: string
  label: string
  /** Variable de antropometría cuando aplica; ausente en filas derivadas (IMC, suma pliegues, etc.). */
  anthroKey?: AnthropometryVariableKey
  resultado: string
  valorAjustado: string
  diffVsAnterior: string
  /** Score-Z requiere tablas normativas; dejamos nota fija hasta calibrar. */
  scoreZ: string
}

function rowId(section: string, label: string): string {
  return `${section}::${label}`
}

function imcFromMeasurement(m: NutritionMeasurement, med: AnthropometryMedians): number | null {
  if (m.bmi != null && Number.isFinite(m.bmi)) return m.bmi
  const h = med.talla_corporal_cm
  return bmiFromKgM(med.peso_bruto_kg ?? null, h != null && h > 0 ? h / 100 : null)
}

function sumSkinfoldsMm(med: AnthropometryMedians): number | null {
  let s = 0
  let n = 0
  for (const k of ANTHRO_SKINFOLD_KEYS) {
    const v = med[k]
    if (v != null && Number.isFinite(v)) {
      s += v
      n += 1
    }
  }
  return n > 0 ? Math.round(s * 10) / 10 : null
}

function waistHipRatio(med: AnthropometryMedians): number | null {
  const w = med.cintura_min_cm
  const h = med.cadera_max_cm
  if (w == null || h == null || !Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return null
  return Math.round((w / h) * 1000) / 1000
}

function appendDerivedRows(
  out: PresentationRow[],
  current: NutritionMeasurement,
  previous: NutritionMeasurement | null,
): void {
  const section = 'INDICADORES DERIVADOS'
  const currM = mergedMediansForPresentation(current)
  const prevM = previous ? mergedMediansForPresentation(previous) : null

  const push = (
    label: string,
    currVal: number | null,
    prevVal: number | null,
    decimals: number,
    diffSuffix: string,
  ) => {
    const res = fmt(currVal, decimals)
    const adj = res
    let diff = '—'
    if (currVal != null && prevVal != null && Number.isFinite(currVal) && Number.isFinite(prevVal)) {
      const d = Math.round((currVal - prevVal) * 1000) / 1000
      diff = `${d > 0 ? '+' : ''}${d}${diffSuffix ? ` ${diffSuffix}` : ''}`
    }
    out.push({
      rowId: rowId(section, label),
      sectionTitle: section,
      label,
      resultado: res,
      valorAjustado: adj,
      diffVsAnterior: diff,
      scoreZ: 'N/D',
    })
  }

  const imcC = imcFromMeasurement(current, currM)
  const imcP = previous && prevM ? imcFromMeasurement(previous, prevM) : null
  push('IMC (registro o peso/talla)', imcC, imcP, 2, 'índice')

  const sumC = sumSkinfoldsMm(currM)
  const sumP = prevM ? sumSkinfoldsMm(prevM) : null
  push('Suma 6 pliegues (mm)', sumC, sumP, 1, 'mm')

  const whrC = waistHipRatio(currM)
  const whrP = prevM ? waistHipRatio(prevM) : null
  push('Ratio cintura/cadera', whrC, whrP, 3, '')
}

export function buildPresentationRows(
  current: NutritionMeasurement,
  previous: NutritionMeasurement | null,
): PresentationRow[] {
  const meta = detailOf(current)?.meta
  const errPct = meta?.measurement_error_pct_default
  const currM = mergedMediansForPresentation(current)
  const prevM = previous ? mergedMediansForPresentation(previous) : null

  const out: PresentationRow[] = []
  for (const block of PRESENTATION_SECTIONS) {
    for (const row of block.rows) {
      const k = row.key
      const v = currM[k] ?? null
      const adj = adjustedValueForPresentation(k, v, errPct)
      const pv = prevM?.[k] ?? null
      let diff = '—'
      if (v != null && pv != null && Number.isFinite(v) && Number.isFinite(pv)) {
        const d = Math.round((v - pv) * 1000) / 1000
        const u = unitForKey(k)
        diff = `${d > 0 ? '+' : ''}${d} ${u}`
      }
      out.push({
        rowId: rowId(block.sectionTitle, row.label),
        sectionTitle: block.sectionTitle,
        label: row.label,
        anthroKey: k,
        resultado: fmt(v, decimalsForKey(k)),
        valorAjustado: fmt(adj, decimalsForKey(k)),
        diffVsAnterior: diff,
        scoreZ: 'N/D',
      })
    }
  }
  appendDerivedRows(out, current, previous)
  return out
}

export function sortMeasurementsDesc(measurements: NutritionMeasurement[]): NutritionMeasurement[] {
  return [...measurements].sort(
    (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
  )
}

export function pickLatestTwoMeasurements(measurements: NutritionMeasurement[]): {
  current: NutritionMeasurement | null
  previous: NutritionMeasurement | null
} {
  const sorted = sortMeasurementsDesc(measurements)
  return { current: sorted[0] ?? null, previous: sorted[1] ?? null }
}

/** Control seleccionado y el inmediatamente anterior (por fecha, más reciente primero). */
export function pickMeasurementPair(
  measurements: NutritionMeasurement[],
  selectedId: string | null,
): { current: NutritionMeasurement | null; previous: NutritionMeasurement | null; sorted: NutritionMeasurement[] } {
  const sorted = sortMeasurementsDesc(measurements)
  const idx =
    selectedId != null ? sorted.findIndex((m) => m.id === selectedId) : 0
  const i = idx >= 0 ? idx : 0
  return {
    sorted,
    current: sorted[i] ?? null,
    previous: sorted[i + 1] ?? null,
  }
}

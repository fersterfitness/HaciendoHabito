import type { NutritionMeasurement } from '@/types/database'
import {
  ANTHRO_ALL_KEYS,
  type AnthropometryDetail,
  type AnthropometryMeta,
  type AnthropometrySeriesBlock,
  type AnthropometryVariableKey,
  type Series5,
} from '@/lib/nutrition/anthropometryProgramModel'

export type AnthropometryFormInputs = Record<
  AnthropometryVariableKey,
  [string, string, string, string, string]
>

function emptyInputs(): AnthropometryFormInputs {
  const z: [string, string, string, string, string] = ['', '', '', '', '']
  const o = {} as AnthropometryFormInputs
  for (const k of ANTHRO_ALL_KEYS) o[k] = [...z]
  return o
}

function seriesToInputs(series: AnthropometrySeriesBlock | undefined): AnthropometryFormInputs {
  const base = emptyInputs()
  if (!series) return base
  for (const k of ANTHRO_ALL_KEYS) {
    const s = series[k] as Series5 | undefined
    if (!s) continue
    base[k] = s.map((v) => (v == null ? '' : String(v))) as [string, string, string, string, string]
  }
  return base
}

export function measurementToFormState(m: NutritionMeasurement): {
  measuredAt: string
  meta: AnthropometryMeta
  inputs: AnthropometryFormInputs
} {
  const detail = (m.detail ?? null) as AnthropometryDetail | null
  const measuredAt = m.measured_at.includes('T')
    ? m.measured_at.slice(0, 10)
    : m.measured_at.slice(0, 10)
  const meta: AnthropometryMeta = {
    ...(detail?.meta ?? {}),
    measurement_number: m.measurement_number ?? detail?.meta?.measurement_number,
  }
  return {
    measuredAt,
    meta,
    inputs: seriesToInputs(detail?.series),
  }
}

export function nextMeasurementNumber(measurements: NutritionMeasurement[]): number {
  const max = measurements.reduce(
    (acc, m) => Math.max(acc, m.measurement_number ?? 0),
    0,
  )
  return max + 1
}

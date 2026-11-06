import {
  ANTHRO_BASIC_KEYS,
  ANTHRO_DIAMETER_KEYS,
  ANTHRO_PERIMETER_KEYS,
  isAnthropometryDetail,
  type AnthropometryVariableKey,
} from './anthropometryProgramModel'
import type { NutritionMeasurement } from '@/types/database'

/**
 * Ayudas para cargar un control a mano: el valor del control anterior al lado de cada medida y un
 * aviso cuando un número parece un error de tipeo (coma corrida, fuera de rango o muy lejos del
 * control anterior o de las otras series).
 */

type Kind = 'peso' | 'talla' | 'diametro' | 'perimetro' | 'pliegue'

function kindOf(key: AnthropometryVariableKey): Kind {
  if (key === 'peso_bruto_kg') return 'peso'
  if ((ANTHRO_BASIC_KEYS as readonly string[]).includes(key)) return 'talla'
  if ((ANTHRO_DIAMETER_KEYS as readonly string[]).includes(key)) return 'diametro'
  if ((ANTHRO_PERIMETER_KEYS as readonly string[]).includes(key)) return 'perimetro'
  return 'pliegue'
}

/** Rango posible de cada tipo de medida (fuera de esto es casi seguro un error). */
const RANGE: Record<Kind, [number, number]> = {
  peso: [20, 250],
  talla: [50, 230],
  diametro: [2, 60],
  perimetro: [10, 200],
  pliegue: [2, 70],
}

/** Cuánto puede cambiar, en proporción, respecto del control anterior sin llamar la atención. */
const MAX_CHANGE: Record<Kind, number> = {
  peso: 0.15,
  talla: 0.04,
  diametro: 0.15,
  perimetro: 0.2,
  pliegue: 0.6,
}

/** Cuánto pueden diferir entre sí las series de una misma medida. */
const MAX_SERIES_SPREAD: Record<Kind, number> = {
  peso: 0.03,
  talla: 0.02,
  diametro: 0.08,
  perimetro: 0.06,
  pliegue: 0.25,
}

const nf = (v: number) => (Math.round(v * 100) / 100).toLocaleString('es-AR')

/**
 * Medianas del control anterior: el más nuevo, o si se está editando uno, el que vino antes de él.
 * Para controles viejos sin detalle, peso y talla salen de las columnas resumen.
 */
export function previousControlValues(
  measurements: NutritionMeasurement[],
  editingId?: string | null,
): Partial<Record<AnthropometryVariableKey, number>> {
  const sorted = [...measurements].sort((a, b) => b.measured_at.localeCompare(a.measured_at))
  let prev: NutritionMeasurement | undefined
  if (editingId) {
    const i = sorted.findIndex((m) => m.id === editingId)
    prev = i >= 0 ? sorted[i + 1] : sorted[0]
  } else prev = sorted[0]
  if (!prev) return {}
  const out: Partial<Record<AnthropometryVariableKey, number>> = {}
  const medians = isAnthropometryDetail(prev.detail) ? prev.detail.medians ?? {} : {}
  for (const [k, v] of Object.entries(medians)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k as AnthropometryVariableKey] = v
  }
  if (out.peso_bruto_kg == null && prev.weight_kg != null) out.peso_bruto_kg = prev.weight_kg
  if (out.talla_corporal_cm == null && prev.height_cm != null) out.talla_corporal_cm = prev.height_cm
  return out
}

/**
 * Aviso para un valor cargado, o null si se ve bien. `siblings` son los otros valores de la misma
 * medida (las otras series), para detectar uno que se escapa del resto.
 */
export function checkAnthroValue(
  key: AnthropometryVariableKey,
  value: number,
  previous: number | null | undefined,
  siblings: number[] = [],
): string | null {
  const kind = kindOf(key)
  const [lo, hi] = RANGE[kind]
  if (previous != null && previous > 0) {
    const ratio = value / previous
    if ((ratio > 7 && ratio < 13) || (ratio > 0.07 && ratio < 0.13)) return `¿Coma corrida? El control anterior fue ${nf(previous)}`
  }
  if (value < lo || value > hi) return `Fuera de lo esperable (${lo}–${hi})`
  // Las otras series que ya son un error (coma corrida, fuera de rango) no sirven de referencia.
  const others = siblings.filter((s) => {
    if (s < lo || s > hi) return false
    if (previous != null && previous > 0) {
      const r = s / previous
      if (r > 7 || r < 0.13) return false
    }
    return true
  })
  if (others.length) {
    const ref = others.slice().sort((a, b) => a - b)[Math.floor(others.length / 2)]!
    if (Math.abs(value - ref) / ref > MAX_SERIES_SPREAD[kind]) return `Muy distinto de las otras series (${nf(ref)})`
  }
  if (previous != null && previous > 0 && Math.abs(value - previous) / previous > MAX_CHANGE[kind]) {
    return `Cambió mucho desde el control anterior (${nf(previous)})`
  }
  return null
}

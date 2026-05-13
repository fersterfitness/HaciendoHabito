/**
 * Modelo alineado al Excel «Programa de Antropometría.xls»:
 * hoja «Proc datos brutos» — variables con hasta 5 series y mediana.
 */

export type AnthropometrySexCode = 1 | 2

export type AnthropometryMeta = {
  sport?: string
  physical_activity?: string
  /** D = deporte, R = recreación (texto libre o letra). */
  depo_recrea?: string
  measurement_number?: number
  sex?: AnthropometrySexCode | null
  /** % error de medición por defecto (el Excel sugiere 2%). */
  measurement_error_pct_default?: number
}

export type Series5 = [number | null, number | null, number | null, number | null, number | null]

export type AnthropometrySeriesBlock = Record<string, Series5>

export type AnthropometryMedians = Record<string, number | null>

export type AnthropometryDetail = {
  meta?: AnthropometryMeta
  /** Valores por variable (hasta 5 mediciones). */
  series?: AnthropometrySeriesBlock
  /** Medianas calculadas (una por variable con datos). */
  medians?: AnthropometryMedians
}

/** Claves en snake_case — orden como en el Excel. */
export const ANTHRO_BASIC_KEYS = ['peso_bruto_kg', 'talla_corporal_cm', 'talla_sentado_cm'] as const

export const ANTHRO_DIAMETER_KEYS = [
  'biacromial_cm',
  'torax_transverso_cm',
  'torax_anteroposterior_cm',
  'biiliocrestideo_cm',
  'humeral_biepicondilar_cm',
  'femoral_biepicondilar_cm',
] as const

export const ANTHRO_PERIMETER_KEYS = [
  'cabeza_cm',
  'brazo_relajado_cm',
  'brazo_flexion_tension_cm',
  'antebrazo_max_cm',
  'torax_mesoesternal_cm',
  'cintura_min_cm',
  'cadera_max_cm',
  'muslo_max_cm',
  'muslo_medial_cm',
  'pantorrilla_max_cm',
] as const

export const ANTHRO_SKINFOLD_KEYS = [
  'triceps_mm',
  'subescapular_mm',
  'supraespinal_mm',
  'abdominal_mm',
  'muslo_medial_mm',
  'pantorrilla_max_mm',
] as const

export const ANTHRO_ALL_KEYS = [
  ...ANTHRO_BASIC_KEYS,
  ...ANTHRO_DIAMETER_KEYS,
  ...ANTHRO_PERIMETER_KEYS,
  ...ANTHRO_SKINFOLD_KEYS,
] as const

export type AnthropometryVariableKey = (typeof ANTHRO_ALL_KEYS)[number]

const LABELS: Record<AnthropometryVariableKey, string> = {
  peso_bruto_kg: 'Peso bruto (kg)',
  talla_corporal_cm: 'Talla corporal (cm)',
  talla_sentado_cm: 'Talla sentado (cm)',
  biacromial_cm: 'Biacromial',
  torax_transverso_cm: 'Tórax transverso',
  torax_anteroposterior_cm: 'Tórax antero-posterior',
  biiliocrestideo_cm: 'Bi-iliocrestídeo',
  humeral_biepicondilar_cm: 'Humeral (biepicondilar)',
  femoral_biepicondilar_cm: 'Femoral (biepicondilar)',
  cabeza_cm: 'Cabeza',
  brazo_relajado_cm: 'Brazo relajado',
  brazo_flexion_tension_cm: 'Brazo flex. en tensión',
  antebrazo_max_cm: 'Antebrazo máximo',
  torax_mesoesternal_cm: 'Tórax mesoesternal',
  cintura_min_cm: 'Cintura (mínima)',
  cadera_max_cm: 'Cadera (máxima)',
  muslo_max_cm: 'Muslo (máximo)',
  muslo_medial_cm: 'Muslo (medial)',
  pantorrilla_max_cm: 'Pantorrilla (máxima)',
  triceps_mm: 'Tríceps',
  subescapular_mm: 'Subescapular',
  supraespinal_mm: 'Supraespinal',
  abdominal_mm: 'Abdominal',
  muslo_medial_mm: 'Muslo medial (pliegue)',
  pantorrilla_max_mm: 'Pantorrilla (pliegue)',
}

export function labelForAnthroKey(key: AnthropometryVariableKey): string {
  return LABELS[key] ?? key
}

export function medianOfSeries(s: Series5): number | null {
  const nums = s.filter((v): v is number => v != null && Number.isFinite(v))
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function computeMediansFromSeries(series: AnthropometrySeriesBlock): AnthropometryMedians {
  const out: AnthropometryMedians = {}
  for (const [k, v] of Object.entries(series)) {
    const m = medianOfSeries(v as Series5)
    if (m != null) out[k] = m
  }
  return out
}

export function emptySeriesBlock(): AnthropometrySeriesBlock {
  const z: Series5 = [null, null, null, null, null]
  const o: AnthropometrySeriesBlock = {}
  for (const k of ANTHRO_ALL_KEYS) o[k] = [...z] as Series5
  return o
}

export function parseSeries5FromStrings(raw: [string, string, string, string, string]): Series5 {
  return raw.map((t) => {
    const s = t.trim().replace(',', '.')
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }) as Series5
}

export function bmiFromKgM(weightKg: number | null, heightM: number | null): number | null {
  if (weightKg == null || heightM == null || heightM <= 0) return null
  const v = weightKg / (heightM * heightM)
  return Math.round(v * 100) / 100
}

/** Texto para campos legacy perimeters_notes / skinfolds_notes. */
export function summarizeMediansForNotes(medians: AnthropometryMedians): { perimeters: string; skinfolds: string } {
  const periParts: string[] = []
  const skinParts: string[] = []
  for (const k of ANTHRO_PERIMETER_KEYS) {
    const v = medians[k]
    if (v != null) periParts.push(`${LABELS[k]}: ${v} cm`)
  }
  for (const k of ANTHRO_SKINFOLD_KEYS) {
    const v = medians[k]
    if (v != null) skinParts.push(`${LABELS[k]}: ${v} mm`)
  }
  return { perimeters: periParts.join(' · '), skinfolds: skinParts.join(' · ') }
}

export function isAnthropometryDetail(x: unknown): x is AnthropometryDetail {
  return typeof x === 'object' && x !== null
}

/**
 * Comparación de dos controles por zona del cuerpo, para el maniquí 3D.
 *
 * Criterio (pensado para el nutricionista):
 * - Pliegues y cintura: bajar es mejorar.
 * - Perímetros de brazo, antebrazo, muslo y pantorrilla: subir es mejorar,
 *   salvo que en esa zona también suba el pliegue → «Revisar» (puede ser grasa).
 * - Tórax y cadera: sin criterio, solo se informa si cambió.
 */

import type { AnthropometryMedians } from './anthropometryProgramModel'

export type BodyZoneId = 'pecho' | 'brazo' | 'antebrazo' | 'abdomen' | 'costado' | 'cadera' | 'muslo' | 'pantorrilla'

export type BodyZoneStatus = 'good' | 'bad' | 'alert' | 'neutral' | 'same' | 'nodata'

type Kind = 'skinfold' | 'waist' | 'muscle' | 'neutral'

interface ZoneMeasure {
  key: string
  label: string
  unit: 'cm' | 'mm'
  kind: Kind
}

export interface BodyZoneDef {
  id: BodyZoneId
  name: string
  measures: ZoneMeasure[]
}

export const BODY_ZONES: BodyZoneDef[] = [
  {
    id: 'pecho',
    name: 'Pecho y espalda',
    measures: [
      { key: 'torax_mesoesternal_cm', label: 'Tórax mesoesternal', unit: 'cm', kind: 'neutral' },
      { key: 'subescapular_mm', label: 'Pliegue subescapular', unit: 'mm', kind: 'skinfold' },
    ],
  },
  {
    id: 'brazo',
    name: 'Brazo',
    measures: [
      { key: 'brazo_relajado_cm', label: 'Brazo relajado', unit: 'cm', kind: 'muscle' },
      { key: 'brazo_flexion_tension_cm', label: 'Brazo en tensión', unit: 'cm', kind: 'muscle' },
      { key: 'triceps_mm', label: 'Pliegue tríceps', unit: 'mm', kind: 'skinfold' },
    ],
  },
  {
    id: 'antebrazo',
    name: 'Antebrazo',
    measures: [{ key: 'antebrazo_max_cm', label: 'Antebrazo máximo', unit: 'cm', kind: 'muscle' }],
  },
  {
    id: 'abdomen',
    name: 'Abdomen',
    measures: [
      { key: 'cintura_min_cm', label: 'Cintura (mínima)', unit: 'cm', kind: 'waist' },
      { key: 'abdominal_mm', label: 'Pliegue abdominal', unit: 'mm', kind: 'skinfold' },
    ],
  },
  {
    id: 'costado',
    name: 'Costado (cresta ilíaca)',
    measures: [{ key: 'supraespinal_mm', label: 'Pliegue supraespinal', unit: 'mm', kind: 'skinfold' }],
  },
  {
    id: 'cadera',
    name: 'Cadera y glúteo',
    measures: [{ key: 'cadera_max_cm', label: 'Cadera (máxima)', unit: 'cm', kind: 'neutral' }],
  },
  {
    id: 'muslo',
    name: 'Muslo',
    measures: [
      { key: 'muslo_max_cm', label: 'Muslo (máximo)', unit: 'cm', kind: 'muscle' },
      { key: 'muslo_medial_cm', label: 'Muslo (medial)', unit: 'cm', kind: 'muscle' },
      { key: 'muslo_medial_mm', label: 'Pliegue muslo', unit: 'mm', kind: 'skinfold' },
    ],
  },
  {
    id: 'pantorrilla',
    name: 'Pantorrilla',
    measures: [
      { key: 'pantorrilla_max_cm', label: 'Pantorrilla (máxima)', unit: 'cm', kind: 'muscle' },
      { key: 'pantorrilla_max_mm', label: 'Pliegue pantorrilla', unit: 'mm', kind: 'skinfold' },
    ],
  },
]

/** Cambios menores a esto se consideran «sin cambio» (error de medición). */
const MIN_CHANGE = { cm: 0.3, mm: 0.3 } as const

export type MeasureVerdict = 'good' | 'bad' | 'neutral' | 'same'

export interface ZoneMeasureRow {
  key: string
  label: string
  unit: 'cm' | 'mm'
  a: number
  b: number
  delta: number
  verdict: MeasureVerdict
}

export interface ZoneComparison {
  zone: BodyZoneDef
  status: BodyZoneStatus
  rows: ZoneMeasureRow[]
  note: string | null
}

function verdictOf(m: ZoneMeasure, delta: number): MeasureVerdict {
  if (Math.abs(delta) < MIN_CHANGE[m.unit]) return 'same'
  if (m.kind === 'neutral') return 'neutral'
  const up = delta > 0
  if (m.kind === 'muscle') return up ? 'good' : 'bad'
  return up ? 'bad' : 'good'
}

function num(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null
}

export function compareZone(zone: BodyZoneDef, a: AnthropometryMedians | null, b: AnthropometryMedians | null): ZoneComparison {
  const rows: ZoneMeasureRow[] = []
  for (const m of zone.measures) {
    const va = num(a?.[m.key]), vb = num(b?.[m.key])
    if (va == null || vb == null) continue
    const delta = Math.round((vb - va) * 100) / 100
    rows.push({ key: m.key, label: m.label, unit: m.unit, a: va, b: vb, delta, verdict: verdictOf(m, delta) })
  }
  if (!rows.length) return { zone, status: 'nodata', rows, note: null }

  const kindOf = (r: ZoneMeasureRow) => zone.measures.find((m) => m.key === r.key)!.kind
  const muscleUp = rows.some((r) => kindOf(r) === 'muscle' && r.verdict === 'good')
  const foldUp = rows.some((r) => kindOf(r) === 'skinfold' && r.verdict === 'bad')
  if (muscleUp && foldUp) return { zone, status: 'alert', rows, note: 'Subió el perímetro junto con el pliegue: puede ser grasa.' }

  const has = (v: MeasureVerdict) => rows.some((r) => r.verdict === v)
  if (has('good') && has('bad')) return { zone, status: 'alert', rows, note: 'Hay medidas que mejoraron y otras que empeoraron.' }
  if (has('bad')) return { zone, status: 'bad', rows, note: null }
  if (has('good')) return { zone, status: 'good', rows, note: null }
  if (has('neutral')) return { zone, status: 'neutral', rows, note: null }
  return { zone, status: 'same', rows, note: null }
}

export function compareBodyZones(a: AnthropometryMedians | null, b: AnthropometryMedians | null): ZoneComparison[] {
  return BODY_ZONES.map((z) => compareZone(z, a, b))
}

export const BODY_ZONE_STATUS_LABEL: Record<BodyZoneStatus, string> = {
  good: 'Mejoró',
  bad: 'Empeoró',
  alert: 'Revisar',
  neutral: 'Cambió',
  same: 'Sin cambio',
  nodata: 'Sin datos',
}

/** Orden de la lista: primero lo que pide atención. */
export const BODY_ZONE_STATUS_ORDER: Record<BodyZoneStatus, number> = { bad: 0, alert: 1, good: 2, neutral: 3, same: 4, nodata: 5 }

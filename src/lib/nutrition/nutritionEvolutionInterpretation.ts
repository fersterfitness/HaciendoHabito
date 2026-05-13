import type { Json } from '@/types/database'
import type { NutritionMeasurement } from '@/types/database'
import type { AnthropometryDetail, AnthropometryMedians } from '@/lib/nutrition/anthropometryProgramModel'

function mediansFromRow(m: NutritionMeasurement): AnthropometryMedians | null {
  const d = m.detail as AnthropometryDetail | null
  if (!d || typeof d !== 'object' || !d.medians) return null
  return d.medians
}

function fmt(n: number | null | undefined, unit: string): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n}${unit}`
}

function deltaLine(label: string, before: number | null, after: number | null, unit: string): string | null {
  if (before == null || after == null) return null
  const d = Math.round((after - before) * 100) / 100
  const dir = d > 0 ? 'aumentó' : d < 0 ? 'disminuyó' : 'se mantuvo'
  return `${label}: ${dir} de ${fmt(before, unit)} a ${fmt(after, unit)} (variación ${d > 0 ? '+' : ''}${d} ${unit}).`
}

export type EvolutionPdfRow = { label: string; from: string; to: string; delta: string }

export function buildEvolutionPdfRows(prev: NutritionMeasurement, curr: NutritionMeasurement): EvolutionPdfRow[] {
  const rows: EvolutionPdfRow[] = []
  const push = (label: string, a: number | null, b: number | null, unit: string) => {
    if (a == null && b == null) return
    const d =
      a != null && b != null ? Math.round((b - a) * 100) / 100 : null
    rows.push({
      label,
      from: fmt(a, unit),
      to: fmt(b, unit),
      delta: d == null ? '—' : `${d > 0 ? '+' : ''}${d} ${unit}`,
    })
  }

  push('Peso (kg)', prev.weight_kg, curr.weight_kg, 'kg')
  push('IMC', prev.bmi, curr.bmi, '')
  push('% Grasa corporal', prev.body_fat_pct, curr.body_fat_pct, '%')
  push('Masa muscular (kg)', prev.muscle_mass_kg, curr.muscle_mass_kg, 'kg')
  push('Talla (cm)', prev.height_cm, curr.height_cm, 'cm')

  const pm = mediansFromRow(prev)
  const cm = mediansFromRow(curr)
  if (pm && cm) {
    push('Cintura mediana (cm)', pm.cintura_min_cm ?? null, cm.cintura_min_cm ?? null, 'cm')
    push('Cadera mediana (cm)', pm.cadera_max_cm ?? null, cm.cadera_max_cm ?? null, 'cm')
    push('Suma pliegues (aprox.)', sumSkinfolds(pm), sumSkinfolds(cm), 'mm')
  }

  return rows
}

function sumSkinfolds(m: AnthropometryMedians): number | null {
  const keys = [
    'triceps_mm',
    'subescapular_mm',
    'supraespinal_mm',
    'abdominal_mm',
    'muslo_medial_mm',
    'pantorrilla_max_mm',
  ] as const
  let s = 0
  let n = 0
  for (const k of keys) {
    const v = m[k]
    if (v != null && Number.isFinite(v)) {
      s += v
      n++
    }
  }
  return n > 0 ? Math.round(s * 10) / 10 : null
}

/**
 * Texto empático para el paciente (plantilla; no sustituye criterio clínico).
 * Incluye disclaimer breve al final.
 */
export function buildPatientFacingInterpretation(
  patientName: string,
  prev: NutritionMeasurement,
  curr: NutritionMeasurement,
  prevDateLabel: string,
  currDateLabel: string,
): string {
  const lines: string[] = []
  lines.push(`Hola ${patientName.split(' ')[0] ?? patientName},`)
  lines.push('')
  lines.push(
    `Este informe resume la evolución entre el control del ${prevDateLabel} y el del ${currDateLabel}. Los números son una foto de tu proceso; lo importante es cómo te sentís y qué sostenés día a día.`,
  )
  lines.push('')

  const w = deltaLine('Peso', prev.weight_kg, curr.weight_kg, 'kg')
  if (w) lines.push(w)
  const f = deltaLine('% Grasa corporal', prev.body_fat_pct, curr.body_fat_pct, '%')
  if (f) lines.push(f)
  const mus = deltaLine('Masa muscular estimada', prev.muscle_mass_kg, curr.muscle_mass_kg, 'kg')
  if (mus) lines.push(mus)

  const pm = mediansFromRow(prev)
  const cm = mediansFromRow(curr)
  if (pm && cm) {
    const cw = deltaLine('Perímetro de cintura (mediana)', pm.cintura_min_cm ?? null, cm.cintura_min_cm ?? null, 'cm')
    if (cw) lines.push(cw)
  }

  lines.push('')
  lines.push(
    'Recordá que los cambios reales suelen ser graduales. Si algo no te cierra o tenés síntomas nuevos, comentámelo en la próxima consulta para ajustar el plan.',
  )
  lines.push('')
  lines.push(
    '— Texto generado como apoyo en Haciéndolo Hábito. No reemplaza la evaluación profesional ni constituye un diagnóstico médico.',
  )

  return lines.join('\n')
}

export function detailJson(d: AnthropometryDetail): Json {
  return d as unknown as Json
}

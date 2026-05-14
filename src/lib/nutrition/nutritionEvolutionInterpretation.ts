import type { Json } from '@/types/database'
import type { NutritionMeasurement } from '@/types/database'
import type { AnthropometryDetail, AnthropometryMedians } from '@/lib/nutrition/anthropometryProgramModel'

export type InterpretationTone = 'empatico' | 'tecnico' | 'motivador'

export const TONE_LABELS: Record<InterpretationTone, string> = {
  empatico: 'Empático (paciente)',
  tecnico: 'Técnico (profesional)',
  motivador: 'Motivador (refuerzo positivo)',
}

function mediansFromRow(m: NutritionMeasurement): AnthropometryMedians | null {
  const d = m.detail as AnthropometryDetail | null
  if (!d || typeof d !== 'object' || !d.medians) return null
  return d.medians
}

function fmt(n: number | null | undefined, unit: string): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n}${unit}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type EvolutionPdfRow = {
  label: string
  from: string
  to: string
  delta: string
  deltaSign: 1 | -1 | 0 | null
}

export function buildEvolutionPdfRows(prev: NutritionMeasurement, curr: NutritionMeasurement): EvolutionPdfRow[] {
  const rows: EvolutionPdfRow[] = []
  const push = (label: string, a: number | null, b: number | null, unit: string) => {
    if (a == null && b == null) return
    const d = a != null && b != null ? round2(b - a) : null
    rows.push({
      label,
      from: fmt(a, unit),
      to: fmt(b, unit),
      delta: d == null ? '—' : `${d > 0 ? '+' : ''}${d} ${unit}`,
      deltaSign: d == null ? null : d > 0 ? 1 : d < 0 ? -1 : 0,
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
  return n > 0 ? round2(s) : null
}

interface DeltasSnapshot {
  weight: number | null
  fat: number | null
  muscle: number | null
  waist: number | null
}

function computeDeltas(prev: NutritionMeasurement, curr: NutritionMeasurement): DeltasSnapshot {
  const pm = mediansFromRow(prev)
  const cm = mediansFromRow(curr)
  return {
    weight: prev.weight_kg != null && curr.weight_kg != null ? round2(curr.weight_kg - prev.weight_kg) : null,
    fat: prev.body_fat_pct != null && curr.body_fat_pct != null ? round2(curr.body_fat_pct - prev.body_fat_pct) : null,
    muscle:
      prev.muscle_mass_kg != null && curr.muscle_mass_kg != null
        ? round2(curr.muscle_mass_kg - prev.muscle_mass_kg)
        : null,
    waist:
      pm?.cintura_min_cm != null && cm?.cintura_min_cm != null
        ? round2(cm.cintura_min_cm - pm.cintura_min_cm)
        : null,
  }
}

/** True if there's at least one delta with meaningful change (not all zero/null). */
function hasMeaningfulChange(d: DeltasSnapshot): boolean {
  return [d.weight, d.fat, d.muscle, d.waist].some((v) => v != null && Math.abs(v) >= 0.1)
}

/** True if most "improvement" indicators went in the desired direction. */
function isOverallImprovement(d: DeltasSnapshot): boolean {
  let good = 0
  let bad = 0
  if (d.fat != null) {
    if (d.fat < -0.1) good++
    else if (d.fat > 0.1) bad++
  }
  if (d.muscle != null) {
    if (d.muscle > 0.1) good++
    else if (d.muscle < -0.1) bad++
  }
  if (d.waist != null) {
    if (d.waist < -0.1) good++
    else if (d.waist > 0.1) bad++
  }
  return good > bad
}

/**
 * Genera la devolución textual de la evolución entre dos controles.
 * El nutricionista puede regenerar con distinto tono.
 *
 * Es texto plantilla. NO sustituye criterio clínico.
 */
export function buildPatientFacingInterpretation(
  patientName: string,
  prev: NutritionMeasurement,
  curr: NutritionMeasurement,
  prevDateLabel: string,
  currDateLabel: string,
  tone: InterpretationTone = 'empatico',
): string {
  const firstName = patientName.split(' ')[0] ?? patientName
  const deltas = computeDeltas(prev, curr)
  const meaningful = hasMeaningfulChange(deltas)
  const improving = meaningful && isOverallImprovement(deltas)

  switch (tone) {
    case 'tecnico':
      return technicalReport(prev, curr, prevDateLabel, currDateLabel, deltas)
    case 'motivador':
      return motivationalReport(firstName, prevDateLabel, currDateLabel, deltas, improving, meaningful)
    case 'empatico':
    default:
      return empathicReport(firstName, prevDateLabel, currDateLabel, deltas, improving, meaningful)
  }
}

function deltaLine(label: string, value: number | null, unit: string, betterDirection: 'down' | 'up' | 'neutral'): string | null {
  if (value == null) return null
  if (Math.abs(value) < 0.1) return `${label}: prácticamente sin cambios.`
  const sign = value > 0 ? '+' : ''
  let qualifier = ''
  if (betterDirection === 'down' && value < 0) qualifier = ' (en dirección esperada).'
  else if (betterDirection === 'up' && value > 0) qualifier = ' (en dirección esperada).'
  else if (betterDirection !== 'neutral') qualifier = ' (sentido contrario al objetivo, repasar plan).'
  return `${label}: ${sign}${value} ${unit}${qualifier ? '' : '.'}${qualifier}`
}

function empathicReport(
  firstName: string,
  prevDate: string,
  currDate: string,
  d: DeltasSnapshot,
  improving: boolean,
  meaningful: boolean,
): string {
  const lines: string[] = []
  lines.push(`Hola ${firstName},`)
  lines.push('')
  lines.push(
    `Este informe resume tu evolución entre el ${prevDate} y el ${currDate}. Los números son una foto del proceso; lo más importante es cómo te sentís y los hábitos que vas sosteniendo.`,
  )
  lines.push('')

  if (!meaningful) {
    lines.push(
      'En este intervalo no hubo cambios significativos en las mediciones. Eso no necesariamente es algo "malo" — a veces el cuerpo necesita una etapa de adaptación, especialmente si venís sosteniendo hábitos nuevos. Conversemos en la próxima consulta para revisar plan, descanso, ciclo y estrés.',
    )
  } else {
    if (improving) {
      lines.push('Buenas noticias: los cambios principales van en la dirección esperada. Quiero destacarlo porque significa que el plan + tus hábitos están funcionando.')
    } else {
      lines.push('Algunas mediciones cambiaron en sentido contrario al objetivo. Eso es información valiosa: sirve para ajustar el plan en la próxima consulta. No te castigues, lo revisamos juntos.')
    }
    lines.push('')

    const w = d.weight
    if (w != null && Math.abs(w) >= 0.1) {
      if (w < 0) lines.push(`• Bajaste ${Math.abs(w)} kg de peso total.`)
      else if (w > 0) lines.push(`• Subiste ${w} kg de peso total.`)
    }
    const f = d.fat
    if (f != null && Math.abs(f) >= 0.1) {
      if (f < 0) lines.push(`• Tu % de grasa corporal bajó ${Math.abs(f)} puntos. Excelente señal.`)
      else lines.push(`• Tu % de grasa corporal subió ${f} puntos.`)
    }
    const m = d.muscle
    if (m != null && Math.abs(m) >= 0.1) {
      if (m > 0) lines.push(`• Sumaste ${m} kg de masa muscular. ¡Ese es el resultado del entrenamiento + proteína consistente!`)
      else lines.push(`• Tu masa muscular bajó ${Math.abs(m)} kg. Vale revisar proteína y descanso.`)
    }
    const ww = d.waist
    if (ww != null && Math.abs(ww) >= 0.1) {
      if (ww < 0) lines.push(`• Tu cintura disminuyó ${Math.abs(ww)} cm — un indicador clave de salud metabólica.`)
      else lines.push(`• Tu cintura aumentó ${ww} cm.`)
    }
  }

  lines.push('')
  lines.push(
    'Recordá que los cambios reales son graduales. Si tenés síntomas nuevos o algo no te cierra, lo charlamos en la próxima consulta para ajustar el plan a vos.',
  )
  lines.push('')
  lines.push('— Texto generado como apoyo en Haciéndolo Hábito. No reemplaza la evaluación profesional ni constituye un diagnóstico médico.')

  return lines.join('\n')
}

function motivationalReport(
  firstName: string,
  prevDate: string,
  currDate: string,
  d: DeltasSnapshot,
  improving: boolean,
  meaningful: boolean,
): string {
  const lines: string[] = []
  lines.push(`¡Hola ${firstName}! 💪`)
  lines.push('')
  lines.push(
    `Acá va tu reporte de evolución del ${prevDate} al ${currDate}. Vamos a celebrar lo que cambió y sumar foco en lo que viene.`,
  )
  lines.push('')

  if (!meaningful) {
    lines.push('Los números no se movieron mucho — y eso también es información. A veces el cuerpo está consolidando los cambios desde adentro (composición, energía, descanso) antes de mostrarlo en la balanza.')
    lines.push('')
    lines.push('Lo que vale acá: ¿estás durmiendo mejor? ¿Tenés más energía? ¿La ropa te queda distinto? Esas son señales reales aunque la medición no las capture aún.')
  } else {
    const wins: string[] = []
    const focuses: string[] = []

    if (d.weight != null && d.weight < -0.1) wins.push(`bajaste ${Math.abs(d.weight)} kg`)
    if (d.fat != null && d.fat < -0.1) wins.push(`bajaste ${Math.abs(d.fat)}% de grasa corporal`)
    if (d.muscle != null && d.muscle > 0.1) wins.push(`ganaste ${d.muscle} kg de masa muscular`)
    if (d.waist != null && d.waist < -0.1) wins.push(`tu cintura bajó ${Math.abs(d.waist)} cm`)

    if (d.weight != null && d.weight > 0.5) focuses.push('subiste algo de peso (puede ser muscular o agua, lo vemos junto)')
    if (d.fat != null && d.fat > 0.5) focuses.push('el % de grasa subió levemente — repasamos comidas y descanso')
    if (d.muscle != null && d.muscle < -0.3) focuses.push('perdiste algo de músculo, focalicemos en proteína')

    if (wins.length > 0) {
      lines.push(`✅ **Para celebrar**: ${wins.join(', ')}.`)
      lines.push('')
      lines.push(improving ? '¡Ese es el resultado de hábitos sostenidos! Sigamos.' : 'Reconocer los avances importa, aunque haya cosas para ajustar.')
    }
    if (focuses.length > 0) {
      lines.push('')
      lines.push(`🎯 **Foco para esta etapa**: ${focuses.join('; ')}.`)
    }
  }

  lines.push('')
  lines.push('🌱 Próxima consulta: vamos a revisar lo que funcionó, ajustar lo que no, y poner objetivos concretos hasta el siguiente control.')
  lines.push('')
  lines.push('— Generado en Haciéndolo Hábito como acompañamiento al plan.')

  return lines.join('\n')
}

function technicalReport(
  prev: NutritionMeasurement,
  curr: NutritionMeasurement,
  prevDate: string,
  currDate: string,
  d: DeltasSnapshot,
): string {
  const lines: string[] = []
  lines.push('Evaluación antropométrica comparativa')
  lines.push('')
  lines.push(`Período: ${prevDate} → ${currDate}`)
  lines.push('')
  lines.push('Variables principales:')
  if (prev.weight_kg != null && curr.weight_kg != null) {
    lines.push(`• Peso corporal: ${prev.weight_kg} → ${curr.weight_kg} kg (Δ ${d.weight! > 0 ? '+' : ''}${d.weight} kg)`)
  }
  if (prev.bmi != null && curr.bmi != null) {
    lines.push(`• IMC: ${prev.bmi} → ${curr.bmi} (Δ ${round2(curr.bmi - prev.bmi)})`)
  }
  if (prev.body_fat_pct != null && curr.body_fat_pct != null) {
    lines.push(`• % Grasa corporal: ${prev.body_fat_pct}% → ${curr.body_fat_pct}% (Δ ${d.fat! > 0 ? '+' : ''}${d.fat}%)`)
  }
  if (prev.muscle_mass_kg != null && curr.muscle_mass_kg != null) {
    lines.push(`• Masa muscular estimada: ${prev.muscle_mass_kg} → ${curr.muscle_mass_kg} kg (Δ ${d.muscle! > 0 ? '+' : ''}${d.muscle} kg)`)
  }

  const pm = mediansFromRow(prev)
  const cm = mediansFromRow(curr)
  if (pm && cm) {
    lines.push('')
    lines.push('Perímetros (medianas del programa antropométrico):')
    if (pm.cintura_min_cm != null && cm.cintura_min_cm != null) {
      lines.push(`• Cintura mínima: ${pm.cintura_min_cm} → ${cm.cintura_min_cm} cm (Δ ${d.waist! > 0 ? '+' : ''}${d.waist} cm)`)
    }
    if (pm.cadera_max_cm != null && cm.cadera_max_cm != null) {
      lines.push(`• Cadera máxima: ${pm.cadera_max_cm} → ${cm.cadera_max_cm} cm`)
    }
    const sp = sumSkinfolds(pm)
    const sc = sumSkinfolds(cm)
    if (sp != null && sc != null) {
      lines.push(`• Suma de pliegues (aprox.): ${sp} → ${sc} mm (Δ ${round2(sc - sp)} mm)`)
    }
  }

  lines.push('')
  lines.push(
    'Interpretación clínica:',
  )
  const interpretations: string[] = []
  const fl = deltaLine('Composición grasa', d.fat, '%', 'down')
  if (fl) interpretations.push(`- ${fl}`)
  const ml = deltaLine('Masa muscular', d.muscle, 'kg', 'up')
  if (ml) interpretations.push(`- ${ml}`)
  const wl = deltaLine('Cintura', d.waist, 'cm', 'down')
  if (wl) interpretations.push(`- ${wl}`)

  if (interpretations.length === 0) {
    lines.push('- Sin variaciones suficientes para interpretación cuantitativa significativa en este intervalo.')
  } else {
    lines.push(...interpretations)
  }

  lines.push('')
  lines.push('Documento técnico generado para uso profesional. Revisar junto a registros dietéticos, actividad física, sueño y estado clínico general.')

  return lines.join('\n')
}

export function detailJson(d: AnthropometryDetail): Json {
  return d as unknown as Json
}

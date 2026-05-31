import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

export interface ParsedAnthropometry {
  rawText: string
  metrics: {
    weightKg?: number
    bmi?: number
    bodyFatPct?: number
    muscleMassKg?: number
  }
  perimeters: Record<string, number>
  skinfolds: Record<string, number>
}

export interface ComparisonMetric {
  from?: number
  to?: number
  delta?: number
}

export interface AnthropometryComparison {
  general: {
    weightKg: ComparisonMetric
    bmi: ComparisonMetric
    bodyFatPct: ComparisonMetric
    muscleMassKg: ComparisonMetric
  }
  perimeters: Array<{ label: string; from: number; to: number; delta: number }>
  skinfolds: Array<{ label: string; from: number; to: number; delta: number }>
}

export interface ComparableMeasurementInput {
  weightKg?: number | null
  bmi?: number | null
  bodyFatPct?: number | null
  muscleMassKg?: number | null
  perimetersNotes?: string | null
  skinfoldsNotes?: string | null
}

const numberPattern = '([0-9]{1,3}(?:[\\.,][0-9]{1,2})?)'

function toNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const value = Number(raw.replace(',', '.'))
  return Number.isFinite(value) ? value : undefined
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function extractMetric(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const n = toNumber(match[1])
      if (n !== undefined) return n
    }
  }
  return undefined
}

function parseSectionRows(text: string, sectionKeywords: string[]): Record<string, number> {
  const rows = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const map: Record<string, number> = {}
  let inSection = false

  for (const line of rows) {
    const normalized = normalizeLabel(line)
    const startsSection = sectionKeywords.some((k) => normalized.includes(k))
    if (startsSection) {
      inSection = true
      continue
    }
    if (inSection && /^(resumen|composicion|diagnostico|observaciones|plan)/i.test(normalized)) {
      inSection = false
    }
    if (!inSection) continue

    const match = line.match(new RegExp(`^(.+?)\\s+${numberPattern}\\s*(?:mm|cm)?$`, 'i'))
    if (!match?.[1] || !match[2]) continue
    const key = normalizeLabel(match[1])
    const value = toNumber(match[2])
    if (key && value !== undefined) {
      map[key] = value
    }
  }

  return map
}

export async function extractPdfTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('No se pudo descargar el PDF para analizar')
  }
  const data = await response.arrayBuffer()
  const doc = await getDocument({ data }).promise
  const parts: string[] = []
  for (let page = 1; page <= doc.numPages; page += 1) {
    const pageRef = await doc.getPage(page)
    const content = await pageRef.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    parts.push(pageText)
  }
  return parts.join('\n')
}

export function parseAnthropometry(text: string): ParsedAnthropometry {
  const normalizedText = text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const weightKg = extractMetric(normalizedText, [
    new RegExp(`peso\\s*(?:actual)?\\s*:?\\s*${numberPattern}\\s*kg`, 'i'),
    new RegExp(`^\\s*peso\\s+${numberPattern}`, 'i'),
  ])
  const bmi = extractMetric(normalizedText, [
    new RegExp(`(?:imc|indice de masa corporal)\\s*:?\\s*${numberPattern}`, 'i'),
  ])
  const bodyFatPct = extractMetric(normalizedText, [
    new RegExp(`(?:%\\s*grasa|grasa\\s*%)\\s*:?\\s*${numberPattern}`, 'i'),
    new RegExp(`(?:tejido adiposo|masa grasa)\\s*:?\\s*${numberPattern}\\s*%`, 'i'),
  ])
  const muscleMassKg = extractMetric(normalizedText, [
    new RegExp(`(?:masa muscular|musculo esquel|muscular total)\\s*:?\\s*${numberPattern}\\s*kg`, 'i'),
  ])

  // We parse line-oriented sections for perimeter/skinfold entries when the report exposes them.
  const lineText = text.replace(/\r/g, '')
  const perimeters = parseSectionRows(lineText, ['perimetro', 'perimetros', 'circunferencias', 'circunferencia'])
  const skinfolds = parseSectionRows(lineText, ['pliegue', 'pliegues'])

  return {
    rawText: text,
    metrics: { weightKg, bmi, bodyFatPct, muscleMassKg },
    perimeters,
    skinfolds,
  }
}

function compareValue(from?: number, to?: number): ComparisonMetric {
  if (from === undefined || to === undefined) return { from, to, delta: undefined }
  return { from, to, delta: Number((to - from).toFixed(2)) }
}

function compareMap(fromMap: Record<string, number>, toMap: Record<string, number>) {
  return Object.keys(toMap)
    .filter((label) => fromMap[label] !== undefined)
    .map((label) => {
      const from = fromMap[label]
      const to = toMap[label]
      const delta = Number((to - from).toFixed(2))
      return { label, from, to, delta }
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

function parseNotesMap(notes: string | null | undefined): Record<string, number> {
  if (!notes) return {}
  const chunks = notes
    .split(/[,\n;]+/)
    .map((c) => c.trim())
    .filter(Boolean)
  const map: Record<string, number> = {}

  for (const chunk of chunks) {
    const match = chunk.match(/(.+?)\s+([0-9]{1,3}(?:[.,][0-9]{1,2})?)/)
    if (!match?.[1] || !match[2]) continue
    const label = normalizeLabel(match[1])
    const value = toNumber(match[2])
    if (!label || value === undefined) continue
    map[label] = value
  }

  return map
}

export function compareAnthropometry(from: ParsedAnthropometry, to: ParsedAnthropometry): AnthropometryComparison {
  return {
    general: {
      weightKg: compareValue(from.metrics.weightKg, to.metrics.weightKg),
      bmi: compareValue(from.metrics.bmi, to.metrics.bmi),
      bodyFatPct: compareValue(from.metrics.bodyFatPct, to.metrics.bodyFatPct),
      muscleMassKg: compareValue(from.metrics.muscleMassKg, to.metrics.muscleMassKg),
    },
    perimeters: compareMap(from.perimeters, to.perimeters),
    skinfolds: compareMap(from.skinfolds, to.skinfolds),
  }
}

export function compareManualMeasurements(
  from: ComparableMeasurementInput,
  to: ComparableMeasurementInput
): AnthropometryComparison {
  return {
    general: {
      weightKg: compareValue(from.weightKg ?? undefined, to.weightKg ?? undefined),
      bmi: compareValue(from.bmi ?? undefined, to.bmi ?? undefined),
      bodyFatPct: compareValue(from.bodyFatPct ?? undefined, to.bodyFatPct ?? undefined),
      muscleMassKg: compareValue(from.muscleMassKg ?? undefined, to.muscleMassKg ?? undefined),
    },
    perimeters: compareMap(parseNotesMap(from.perimetersNotes), parseNotesMap(to.perimetersNotes)),
    skinfolds: compareMap(parseNotesMap(from.skinfoldsNotes), parseNotesMap(to.skinfoldsNotes)),
  }
}

/**
 * Frase natural para una métrica general. Devuelve `null` si no hay variación
 * comparable (así la omitimos en lugar de escribir "no se pudo identificar…").
 */
function metricPhrase(delta: number | undefined, subject: string, unit: string): string | null {
  if (delta === undefined) return null
  if (delta === 0) return `${subject} se mantuvo estable`
  const verb = delta > 0 ? 'aumentó' : 'descendió'
  const amount = `${Math.abs(delta).toFixed(2)} ${unit}`.trim()
  return `${subject} ${verb} ${amount}`
}

/** Une frases con comas y "y" antes de la última, para que lea como prosa. */
function joinPhrases(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]!
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]!}`
}

function formatDelta(delta: number | undefined, unit: string): string {
  if (delta === undefined) return 'sin dato'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(2)} ${unit}`
}

function topChanges(items: Array<{ label: string; delta: number }>, limit = 4) {
  return items.filter((i) => i.delta !== 0).slice(0, limit)
}

/**
 * Devolución clínica redactada a partir de la comparación. Solo menciona las
 * métricas con variación comparable: las que faltan se omiten (en vez de llenar
 * el texto con "no se pudo identificar…"). Si no hay nada comparable, lo dice de
 * forma clara y accionable.
 */
export function buildComparativeNarrative(
  patientName: string,
  comparison: AnthropometryComparison
): string {
  const { general, perimeters, skinfolds } = comparison
  const firstName = patientName.trim().split(/\s+/)[0] || patientName.trim() || 'el paciente'

  const generalPhrases = [
    metricPhrase(general.weightKg.delta, 'el peso', 'kg'),
    metricPhrase(general.bmi.delta, 'el IMC', 'puntos'),
    metricPhrase(general.bodyFatPct.delta, 'el porcentaje graso', '%'),
    metricPhrase(general.muscleMassKg.delta, 'la masa muscular', 'kg'),
  ].filter((s): s is string => s !== null)

  const periTop = topChanges(perimeters.map((p) => ({ label: p.label, delta: p.delta })))
  const skinTop = topChanges(skinfolds.map((p) => ({ label: p.label, delta: p.delta })))

  const supportiveClosure =
    'La lectura busca acompañar el proceso con objetivos realistas, reforzando adherencia y ajustes graduales, y debe interpretarse junto con la adherencia, los síntomas y el contexto del paciente.'

  // Sin ninguna métrica comparable: mensaje claro y accionable, sin relleno.
  if (generalPhrases.length === 0 && periTop.length === 0 && skinTop.length === 0) {
    return `No se pudieron extraer métricas comparables entre ambos controles de ${firstName}. Verificá que los dos PDF correspondan al mismo tipo de estudio antropométrico (o cargá los valores como medición manual) y volvé a generar el análisis.`
  }

  const sentences: string[] = []

  if (generalPhrases.length > 0) {
    sentences.push(`Al comparar ambos controles de ${firstName}, ${joinPhrases(generalPhrases)}.`)
  } else {
    sentences.push(
      `En los controles de ${firstName} no se identificaron variaciones de peso, IMC, % graso ni masa muscular, pero sí cambios en las mediciones segmentarias.`,
    )
  }

  if (periTop.length > 0) {
    sentences.push(
      `En perímetros, los cambios más marcados fueron ${periTop
        .map((p) => `${p.label} (${formatDelta(p.delta, 'cm')})`)
        .join(', ')}.`,
    )
  }

  if (skinTop.length > 0) {
    sentences.push(
      `En pliegues, se destacaron ${skinTop
        .map((p) => `${p.label} (${formatDelta(p.delta, 'mm')})`)
        .join(', ')}.`,
    )
  }

  sentences.push(supportiveClosure)
  return sentences.join(' ')
}

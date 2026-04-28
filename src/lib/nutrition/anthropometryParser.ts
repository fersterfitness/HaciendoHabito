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

function describeDirection(delta: number | undefined, positiveText: string, negativeText: string): string | null {
  if (delta === undefined) return null
  if (delta > 0) return positiveText
  if (delta < 0) return negativeText
  return 'se mantuvo estable'
}

function formatDelta(delta: number | undefined, unit: string): string {
  if (delta === undefined) return 'sin dato'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(2)} ${unit}`
}

function topChanges(items: Array<{ label: string; delta: number }>, limit = 4) {
  return items.filter((i) => i.delta !== 0).slice(0, limit)
}

export function buildComparativeNarrative(
  patientName: string,
  comparison: AnthropometryComparison
): string {
  const { general, perimeters, skinfolds } = comparison

  const weightSentence = describeDirection(
    general.weightKg.delta,
    `el peso mostró un aumento de ${formatDelta(general.weightKg.delta, 'kg')}`,
    `el peso mostró una disminución de ${formatDelta(general.weightKg.delta, 'kg')}`
  ) ?? 'no se pudo identificar peso en ambos estudios'

  const bmiSentence = describeDirection(
    general.bmi.delta,
    `el IMC subió ${formatDelta(general.bmi.delta, 'puntos')}`,
    `el IMC bajó ${formatDelta(general.bmi.delta, 'puntos')}`
  ) ?? 'no se pudo calcular variación de IMC'

  const fatSentence = describeDirection(
    general.bodyFatPct.delta,
    `el porcentaje graso aumentó ${formatDelta(general.bodyFatPct.delta, '%')}`,
    `el porcentaje graso descendió ${formatDelta(general.bodyFatPct.delta, '%')}`
  ) ?? 'no se pudo identificar el porcentaje graso en ambos controles'

  const muscleSentence = describeDirection(
    general.muscleMassKg.delta,
    `la masa muscular aumentó ${formatDelta(general.muscleMassKg.delta, 'kg')}`,
    `la masa muscular disminuyó ${formatDelta(general.muscleMassKg.delta, 'kg')}`
  ) ?? 'no se pudo identificar la masa muscular en ambos controles'

  const periTop = topChanges(perimeters.map((p) => ({ label: p.label, delta: p.delta })))
  const skinTop = topChanges(skinfolds.map((p) => ({ label: p.label, delta: p.delta })))

  const perimetersText = periTop.length
    ? `En perímetros, los cambios más relevantes se observaron en ${periTop
        .map((p) => `${p.label} (${formatDelta(p.delta, 'cm')})`)
        .join(', ')}.`
    : 'No se detectaron variaciones comparables de perímetros en los dos archivos o el PDF no trae ese detalle.'

  const skinfoldsText = skinTop.length
    ? `En pliegues, se destacaron ${skinTop
        .map((p) => `${p.label} (${formatDelta(p.delta, 'mm')})`)
        .join(', ')}.`
    : 'No se detectaron variaciones comparables de pliegues en los dos archivos o el PDF no trae ese detalle.'

  const supportiveClosure =
    'La interpretación se orienta a acompañar el proceso con objetivos realistas, reforzando adherencia y ajustes graduales sin emitir juicios, priorizando salud y continuidad.'

  return `Para ${patientName}, al comparar ambos controles se observa que ${weightSentence}; además, ${bmiSentence}. En composición corporal, ${fatSentence} y ${muscleSentence}. ${perimetersText} ${skinfoldsText} ${supportiveClosure}`
}

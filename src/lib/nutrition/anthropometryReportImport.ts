import type { AnthropometryVariableKey } from '@/lib/nutrition/anthropometryProgramModel'

/**
 * Lectura del "Informe de Composición Corporal" (planilla de Holway exportada a PDF).
 * Sólo trabaja con texto ya separado en líneas, así se puede probar sin pdf.js.
 */

export interface PdfTextItem {
  str: string
  x: number
  y: number
}

export interface ImportedAnthropometry {
  values: Partial<Record<AnthropometryVariableKey, number>>
  measuredAt: string | null
  measurementNumber: number | null
  patientName: string | null
  bodyFatPct: number | null
  muscleMassKg: number | null
  /** Variables del programa que el informe no trajo. */
  missing: AnthropometryVariableKey[]
}

/** Agrupa los fragmentos de texto de una página en renglones (de arriba hacia abajo, de izquierda a derecha). */
export function groupIntoLines(items: PdfTextItem[], tolerance = 2.5): string[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: { y: number; items: PdfTextItem[] }[] = []
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tolerance)
    if (row) row.items.push(it)
    else rows.push({ y: it.y, items: [it] })
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const NUM = /^[-−]?\d+(?:[.,]\d+)?%?$/

function toNum(raw: string): number | null {
  const n = Number(raw.replace('−', '-').replace('%', '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Etiqueta del informe (normalizada) → variable. Las que se repiten dependen de la sección. */
const LABELS: Record<string, AnthropometryVariableKey | { cm: AnthropometryVariableKey; mm: AnthropometryVariableKey }> = {
  'peso kg': 'peso_bruto_kg',
  'peso bruto kg': 'peso_bruto_kg',
  'talla cm': 'talla_corporal_cm',
  'talla corporal cm': 'talla_corporal_cm',
  'talla sentado cm': 'talla_sentado_cm',
  biacromial: 'biacromial_cm',
  'torax transverso': 'torax_transverso_cm',
  'torax anteroposterior': 'torax_anteroposterior_cm',
  'torax antero posterior': 'torax_anteroposterior_cm',
  'bi iliocrestideo': 'biiliocrestideo_cm',
  biiliocrestideo: 'biiliocrestideo_cm',
  'humeral biepicondilar': 'humeral_biepicondilar_cm',
  'femoral biepicondilar': 'femoral_biepicondilar_cm',
  cabeza: 'cabeza_cm',
  'brazo relajado': 'brazo_relajado_cm',
  'brazo flexionado en tension': 'brazo_flexion_tension_cm',
  'brazo flex en tension': 'brazo_flexion_tension_cm',
  antebrazo: 'antebrazo_max_cm',
  'antebrazo maximo': 'antebrazo_max_cm',
  'torax mesoesternal': 'torax_mesoesternal_cm',
  'cintura minima': 'cintura_min_cm',
  cintura: 'cintura_min_cm',
  'caderas maxima': 'cadera_max_cm',
  'cadera maxima': 'cadera_max_cm',
  'muslo superior': 'muslo_max_cm',
  'muslo maximo': 'muslo_max_cm',
  'muslo medial': { cm: 'muslo_medial_cm', mm: 'muslo_medial_mm' },
  'pantorrilla maxima': { cm: 'pantorrilla_max_cm', mm: 'pantorrilla_max_mm' },
  pantorrilla: { cm: 'pantorrilla_max_cm', mm: 'pantorrilla_max_mm' },
  triceps: 'triceps_mm',
  subescapular: 'subescapular_mm',
  supraespinal: 'supraespinal_mm',
  abdominal: 'abdominal_mm',
}

/** Más largas primero, para que "pantorrilla maxima" gane sobre "pantorrilla". */
const LABEL_KEYS = Object.keys(LABELS).sort((a, b) => b.length - a.length)

const ALL_KEYS: AnthropometryVariableKey[] = [
  'peso_bruto_kg', 'talla_corporal_cm', 'talla_sentado_cm',
  'biacromial_cm', 'torax_transverso_cm', 'torax_anteroposterior_cm', 'biiliocrestideo_cm', 'humeral_biepicondilar_cm', 'femoral_biepicondilar_cm',
  'cabeza_cm', 'brazo_relajado_cm', 'brazo_flexion_tension_cm', 'antebrazo_max_cm', 'torax_mesoesternal_cm', 'cintura_min_cm', 'cadera_max_cm', 'muslo_max_cm', 'muslo_medial_cm', 'pantorrilla_max_cm',
  'triceps_mm', 'subescapular_mm', 'supraespinal_mm', 'abdominal_mm', 'muslo_medial_mm', 'pantorrilla_max_mm',
]

/** Separa un renglón en etiqueta (texto antes del primer número) y números. */
function splitRow(line: string): { label: string; nums: string[] } {
  const tokens = line.split(' ')
  const i = tokens.findIndex((t) => NUM.test(t))
  if (i <= 0) return { label: '', nums: [] }
  return { label: norm(tokens.slice(0, i).join(' ')), nums: tokens.slice(i).filter((t) => NUM.test(t)) }
}

export function parseAnthropometryReport(pages: string[][]): ImportedAnthropometry {
  const values: ImportedAnthropometry['values'] = {}
  let inSkinfolds = false

  // Variables: la primera página que las trae (en las otras se repiten sólo como leyendas).
  for (const lines of pages) {
    for (const line of lines) {
      const { label, nums } = splitRow(line)
      if (!label || !nums.length) continue
      // El rótulo vertical de la sección ("DIAMETROS (cm)") puede quedar pegado delante: se busca la etiqueta al final.
      const known = LABEL_KEYS.find((l) => label === l || label.endsWith(` ${l}`))
      if (!known) continue
      const target = LABELS[known]
      if (known === 'triceps' || /\bpliegues\b/.test(label)) inSkinfolds = true
      const key = typeof target === 'string' ? target : inSkinfolds ? target.mm : target.cm
      const v = toNum(nums[0])
      if (v == null || v <= 0 || key in values) continue
      values[key] = v
    }
    if (values.peso_bruto_kg != null) break
  }

  const all = pages.flat()
  const text = all.join('\n')
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '')

  let measuredAt: string | null = null
  const d = plain.match(/fecha de medici[o]n:?\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i)
  if (d) {
    const y = d[3].length === 2 ? `20${d[3]}` : d[3]
    const mm = Number(d[2])
    const dd = Number(d[1])
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) measuredAt = `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }

  const n = plain.match(/numero de medicion:?\s*(\d{1,3})\b/i)
  const measurementNumber = n ? Number(n[1]) : null

  const name = text.match(/Nombre:\s*(.+?)\s*(?:Edad:|$)/m)
  const patientName = name && name[1].trim() && !/^edad/i.test(name[1]) ? name[1].trim() : null

  // Fraccionamiento en 5 masas (Kerr): "Masa Adiposa <kg> <porcentaje>% <kg ajustado> ..."
  function mass(prefix: string): { pct: number | null; kg: number | null } {
    for (const line of all) {
      if (!norm(line).startsWith(prefix)) continue
      const tokens = line.split(' ').filter((t) => NUM.test(t))
      const p = tokens.findIndex((t) => t.endsWith('%'))
      if (p < 0) continue
      return { pct: toNum(tokens[p]), kg: tokens[p + 1] ? toNum(tokens[p + 1]) : p > 0 ? toNum(tokens[p - 1]) : null }
    }
    return { pct: null, kg: null }
  }
  const fat = mass('masa adiposa')
  const muscle = mass('masa muscular')

  return {
    values,
    measuredAt,
    measurementNumber,
    patientName,
    bodyFatPct: fat.pct,
    muscleMassKg: muscle.kg,
    missing: ALL_KEYS.filter((k) => values[k] == null),
  }
}

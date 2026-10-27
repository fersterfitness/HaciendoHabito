/** Structured fields embedded in routine_exercises.technical_notes (hidden from athlete-facing PDF lines). */

/** Prescripción de UNA serie (multiarticulares): % del 1RM, kg calculado, reps y RPE/RIR. */
export interface SeriesPlanEntry {
  pct?: string
  kg?: string
  reps?: string
  rpeRir?: string
}

export interface ExerciseMeta {
  restText?: string
  rpeText?: string
  percent1rm?: string
  circuitNote?: string
  /** Multiarticulares: plan serie por serie (index = serie 1..N). */
  seriesPlan?: SeriesPlanEntry[]
}

export function seriesPlanHasData(plan: SeriesPlanEntry[] | undefined): boolean {
  return !!plan?.some((s) => s.pct?.trim() || s.reps?.trim() || s.rpeRir?.trim())
}

/**
 * Esfuerzo con notación de arroba: `8` / `RPE 8` → `@8`, `RPE 7-8` → `@7-8`.
 * Si es RIR (o texto libre) se deja como está.
 */
export function formatEffortAt(raw: string | number | null | undefined): string | null {
  const t = raw == null ? '' : String(raw).trim()
  if (!t) return null
  if (/rir/i.test(t) || t.startsWith('@')) return t
  const m = /^rpe\s*[:.]?\s*(.+)$/i.exec(t)
  const v = (m ? m[1] : t).trim()
  return /^\d/.test(v) ? `@${v}` : t
}

/** Línea compacta por serie: `S1 94,5kg (70%) ×5 · @6o7 | S2 …`. */
export function formatSeriesPlanLine(plan: SeriesPlanEntry[] | undefined): string | null {
  if (!seriesPlanHasData(plan)) return null
  const parts = (plan ?? []).map((s, i) => {
    const bits: string[] = []
    if (s.kg?.trim()) bits.push(`${s.kg.trim()} kg`)
    if (s.pct?.trim()) bits.push(`(${s.pct.trim()}%)`)
    if (s.reps?.trim()) bits.push(`×${s.reps.trim()}`)
    const effort = formatEffortAt(s.rpeRir)
    if (effort) bits.push(`· ${effort}`)
    if (bits.length === 0) return null
    return `S${i + 1} ${bits.join(' ')}`
  })
  const clean = parts.filter(Boolean)
  return clean.length > 0 ? clean.join('  |  ') : null
}

function normalizeTechnicalNotes(raw: string): string {
  return raw
    .replace(/\uFEFF/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
}

/** Quita cualquier bloque META aunque falle JSON — útil solo para vistas (PDF) */
export function stripMetaBlocks(raw: string | null | undefined): string {
  const s = normalizeTechnicalNotes(raw ?? '').replace(
    /\[\[\s*META\s*\]\]\s*[\s\S]*?\s*\[\[\s*\/\s*META\s*\]\]/gi,
    '',
  )
  return s.replace(/\s+\n/g, '\n').trim()
}

export function parseExerciseMeta(
  technicalNotes: string | null | undefined,
): { userNotes: string; meta: ExerciseMeta } {
  const normalized = normalizeTechnicalNotes(technicalNotes ?? '')

  let meta: ExerciseMeta = {}
  const first = /\[\[\s*META\s*\]\]\s*([\s\S]*?)\s*\[\[\s*\/\s*META\s*\]\]/i.exec(normalized)
  if (first) {
    try {
      const chunk = first[1].trim()
      if (chunk.startsWith('{')) meta = JSON.parse(chunk) as ExerciseMeta
    } catch {
      /* META mal formado: igual lo sacamos en strip */
    }
  }

  const userNotes = stripMetaBlocks(normalized)
  return { userNotes, meta }
}

export function buildExerciseTechnicalNotes(userNotes: string, meta: ExerciseMeta): string {
  if (meta.seriesPlan && !seriesPlanHasData(meta.seriesPlan)) delete meta.seriesPlan
  const hasMeta = Boolean(
    meta.restText || meta.rpeText || meta.percent1rm || meta.circuitNote || meta.seriesPlan,
  )
  const cleanUserNotes = userNotes.trim()
  if (!hasMeta) return cleanUserNotes
  const payload = JSON.stringify(meta)
  return `[[META]]\n${payload}\n[[/META]]\n${cleanUserNotes}`.trim()
}

function parsePercentValue(raw?: string): number | null {
  const v = raw?.trim()
  if (!v) return null
  const n = Number(v.replace(',', '.'))
  return !Number.isNaN(n) && n > 0 ? n : null
}

/** Single-decimal trim for display */
function fmtKg(n: number): string {
  const r = Math.round(n * 10) / 10
  if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r))
  return String(r)
}

export interface PdfExerciseRowDisplay {
  weightCell: string
  notesClean: string
  /** Descanso: texto del META (ej. 2′) o segundos numéricos */
  restDisplay: string
  rpeDisplay: string
  rirDisplay: string
  /** Multiarticulares: detalle serie por serie (kg/%/reps/RPE-RIR); null si no hay plan. */
  seriesPlanLine: string | null
  /** Multiarticulares: una fila por serie (n = 1..N) para mostrarlas numeradas en columnas. */
  seriesRows: PdfSeriesRow[] | null
}

export interface PdfSeriesRow {
  n: number
  /** `118,9 kg` (recalculado con el 1RM vigente si hay %); '' si no hay. */
  kg: string
  pct: string
  reps: string
  /** `@8` o el texto de RIR tal cual. */
  effort: string
}

/** Serie por serie: si hay % y 1RM, el kg se recalcula con el RM vigente (no el guardado al editar). */
export function buildPdfSeriesRows(plan: SeriesPlanEntry[] | undefined, rmKg?: number | null): PdfSeriesRow[] | null {
  if (!seriesPlanHasData(plan)) return null
  const rmOk = rmKg != null && rmKg > 0
  return (plan ?? []).map((s, i) => {
    const pct = parsePercentValue(s.pct)
    const storedKg = parsePercentValue(s.kg)
    const kgNum = pct !== null && rmOk ? Math.round(((rmKg as number) * pct) / 100 * 10) / 10 : storedKg
    return {
      n: i + 1,
      kg: kgNum !== null ? `${fmtKg(kgNum).replace('.', ',')} kg` : '',
      pct: pct !== null ? `${pct}%` : '',
      reps: s.reps?.trim() ?? '',
      effort: formatEffortAt(s.rpeRir) ?? '',
    }
  })
}

/** PDF / informes: peso visible en kg; notas sin bloque META. */
export function pdfExerciseDisplay(
  exercise: {
    exercise_id?: string | null
    weight_kg: number | null
    technical_notes: string | null
    rest_seconds?: number | null
    rpe?: number | null
    rir?: number | null
  },
  rmKg?: number | null,
): PdfExerciseRowDisplay {
  const { userNotes, meta } = parseExerciseMeta(exercise.technical_notes)
  const pct = parsePercentValue(meta.percent1rm)
  const rmOk = rmKg != null && rmKg > 0
  const computedKg =
    pct !== null && rmOk ? Math.round(((rmKg as number) * pct) / 100 * 10) / 10 : null
  const seriesPlanLine = formatSeriesPlanLine(meta.seriesPlan)

  let weightCell = '—'

  // Con plan por serie, el PDF muestra los kg de cada serie en la columna (ver seriesRows).
  if (exercise.weight_kg != null) {
    weightCell = `${fmtKg(exercise.weight_kg)} kg`
    if (pct !== null) weightCell += ` (${pct}% 1RM)`
  } else if (computedKg !== null) {
    weightCell = `${fmtKg(computedKg)} kg (${pct}% × 1RM ${fmtKg(rmKg as number)} kg)`
  } else if (pct !== null && !rmOk) {
    weightCell = `${pct}% · sin 1RM (cargá peso en kg o registrar 1RM)`
  }

  const restDisplay =
    meta.restText?.trim() ||
    (exercise.rest_seconds != null && exercise.rest_seconds > 0
      ? `${exercise.rest_seconds}″`
      : '—')

  const rpeFromCol = (() => {
    const raw = exercise.rpe as unknown
    if (raw === null || raw === undefined || raw === '') return null
    const n = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(n) ? String(n) : null
  })()

  const rpeDisplay = formatEffortAt(meta.rpeText) || formatEffortAt(rpeFromCol) || '—'

  const rirFromCol = (() => {
    const raw = exercise.rir as unknown
    if (raw === null || raw === undefined || raw === '') return null
    const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
    return Number.isFinite(n) ? String(n) : null
  })()

  const rirDisplay = rirFromCol || '—'

  return {
    weightCell,
    notesClean: userNotes.trim(),
    restDisplay,
    rpeDisplay,
    rirDisplay,
    seriesPlanLine,
    seriesRows: buildPdfSeriesRows(meta.seriesPlan, rmKg),
  }
}

/** Structured fields embedded in routine_exercises.technical_notes (hidden from athlete-facing PDF lines). */

export interface ExerciseMeta {
  restText?: string
  rpeText?: string
  percent1rm?: string
  circuitNote?: string
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
  const hasMeta = Boolean(meta.restText || meta.rpeText || meta.percent1rm || meta.circuitNote)
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
}

/** PDF / informes: peso visible en kg; notas sin bloque META. */
export function pdfExerciseDisplay(
  exercise: {
    exercise_id?: string | null
    weight_kg: number | null
    technical_notes: string | null
  },
  rmKg?: number | null,
): PdfExerciseRowDisplay {
  const { userNotes, meta } = parseExerciseMeta(exercise.technical_notes)
  const pct = parsePercentValue(meta.percent1rm)
  const rmOk = rmKg != null && rmKg > 0
  const computedKg =
    pct !== null && rmOk ? Math.round(((rmKg as number) * pct) / 100 * 10) / 10 : null

  let weightCell = '—'

  if (exercise.weight_kg != null) {
    weightCell = `${fmtKg(exercise.weight_kg)} kg`
    if (pct !== null) weightCell += ` (${pct}% 1RM)`
  } else if (computedKg !== null) {
    weightCell = `${fmtKg(computedKg)} kg (${pct}% × 1RM ${fmtKg(rmKg as number)} kg)`
  } else if (pct !== null && !rmOk) {
    weightCell = `${pct}% · sin 1RM (cargá peso en kg o registrar 1RM)`
  }

  return {
    weightCell,
    notesClean: userNotes.trim(),
  }
}

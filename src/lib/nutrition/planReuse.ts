import { normalizeWeeklyGrid, type WeeklyPlanGridJson } from './weeklyPlanGrid'

/**
 * Reusar planes: partir de una plantilla de la biblioteca o del plan de otro paciente, y guardar
 * el plan de un paciente como plantilla.
 */

/** Plan que se puede tomar como base. */
export type ReusablePlan = {
  id: string
  /** De dónde sale: una plantilla o el plan activo de otro paciente. */
  source: 'template' | 'patient'
  name: string
  /** Objetivo de la plantilla, o nada. */
  subtitle: string | null
  mergeWeekends: boolean
  grid: WeeklyPlanGridJson
  /** Para plantillas: id en la biblioteca. */
  libraryId: string | null
  notes: string | null
  updatedAt: string
}

/** true si alguna comida tiene algo escrito. */
export function gridHasContent(grid: WeeklyPlanGridJson | null | undefined): boolean {
  if (!grid) return false
  return grid.mealRows.some((r) => r.columns.some((c) => c.trim() !== ''))
}

/** Una línea por comida con lo del primer día que tenga algo, para mirar el plan sin abrirlo. */
export function planPreviewLines(grid: WeeklyPlanGridJson, max = 6): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = []
  for (const row of grid.mealRows) {
    const first = row.columns.find((c) => c.trim() !== '')
    if (!first) continue
    out.push({ label: row.label.trim() || 'Comida', text: first.replace(/\s+/g, ' ').trim() })
    if (out.length >= max) break
  }
  return out
}

/** Texto para buscar: nombre, objetivo y lo que dice el plan. */
export function matchesPlanQuery(plan: ReusablePlan, query: string): boolean {
  const q = fold(query.trim())
  if (!q) return true
  const haystack = fold(
    [plan.name, plan.subtitle ?? '', ...plan.grid.mealRows.flatMap((r) => [r.label, ...r.columns])].join(' '),
  )
  return q.split(/\s+/).every((w) => haystack.includes(w))
}

/** Normaliza una fila de la base (plantilla o versión de plan) al formato común. */
export function toReusablePlan(row: {
  id: string
  source: ReusablePlan['source']
  name: string
  subtitle?: string | null
  merge_weekends: boolean
  grid: unknown
  libraryId?: string | null
  notes?: string | null
  updated_at: string
}): ReusablePlan {
  return {
    id: row.id,
    source: row.source,
    name: row.name,
    subtitle: row.subtitle?.trim() || null,
    mergeWeekends: !!row.merge_weekends,
    grid: normalizeWeeklyGrid(row.grid, !!row.merge_weekends),
    libraryId: row.libraryId ?? null,
    notes: row.notes ?? null,
    updatedAt: row.updated_at,
  }
}

function fold(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

import { parseLocaleNumberOrZero } from '@/lib/nutrition/planningCalculations'
import type { MealDistributionState, MealSlotKey, PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'
import { MEAL_SLOT_KEYS, normalizeMealDistribution } from '@/lib/nutrition/planningWorkbookTypes'

/** Ids de Mi lista que aparecen en algún momento del día. */
export function libraryFoodIdsUsedInMeals(md: MealDistributionState): Set<string> {
  const ids = new Set<string>()
  const m = md.picksByMeal
  if (!m) return ids
  for (const picks of Object.values(m)) {
    if (!Array.isArray(picks)) continue
    for (const p of picks) {
      if (p.kind === 'library' && p.libraryFoodId) ids.add(p.libraryFoodId)
    }
  }
  return ids
}

/**
 * Mi lista con gramos en la tabla «Alimentos personalizados» que no están en ningún momento (no salen al PDF).
 */
export function orphanLibraryDraftLibIds(wb: PlanningWorkbookStateV1): string[] {
  const md = normalizeMealDistribution(wb.mealDistribution)
  const inMeals = libraryFoodIdsUsedInMeals(md)
  const draft = wb.libraryQtyDraft ?? {}
  const out: string[] = []
  for (const [libId, qtyStr] of Object.entries(draft)) {
    if (parseLocaleNumberOrZero(qtyStr) <= 0) continue
    if (!inMeals.has(libId)) out.push(libId)
  }
  return out
}

export function visibleMealSlotKeys(md: MealDistributionState): MealSlotKey[] {
  return MEAL_SLOT_KEYS.filter((k) => {
    if (k === 'mediaManana' && !md.includeMidMorning) return false
    if (k === 'mediaTarde' && !md.includeMidAfternoon) return false
    return true
  })
}

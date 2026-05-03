import type { MealDistributionState } from '@/lib/nutrition/planningWorkbookTypes'
import { normalizeMealDistribution } from '@/lib/nutrition/planningWorkbookTypes'

const STORAGE_KEY = 'hh-meal-dist-templates-v1'

export type MealDistributionTemplate = {
  id: string
  name: string
  savedAt: string
  mealDistribution: MealDistributionState
}

function readAll(): MealDistributionTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (x) =>
        x &&
        typeof x === 'object' &&
        typeof (x as MealDistributionTemplate).id === 'string' &&
        typeof (x as MealDistributionTemplate).name === 'string',
    ) as MealDistributionTemplate[]
  } catch {
    return []
  }
}

function writeAll(list: MealDistributionTemplate[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota */
  }
}

export function listMealDistributionTemplates(): MealDistributionTemplate[] {
  return readAll().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
}

export function saveMealDistributionTemplate(name: string, md: MealDistributionState): MealDistributionTemplate | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const snapshot = normalizeMealDistribution(md)
  const item: MealDistributionTemplate = {
    id: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    name: trimmed.slice(0, 80),
    savedAt: new Date().toISOString(),
    mealDistribution: snapshot,
  }
  const list = readAll()
  list.push(item)
  writeAll(list)
  return item
}

export function removeMealDistributionTemplate(id: string): void {
  const list = readAll().filter((t) => t.id !== id)
  writeAll(list)
}

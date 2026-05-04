import type { MuscleGroup } from '@/types/database'

/** Slug estable para `muscle_groups.slug` (único con sufijo de tiempo en el caller). */
export function slugifyMuscleCatalogName(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return base || 'grupo'
}

export function nextMuscleGroupSortOrder(catalog: MuscleGroup[]): number {
  return catalog.reduce((m, g) => Math.max(m, g.sort_order), 0) + 1
}

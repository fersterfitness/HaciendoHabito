import { normalizeWebPlanCatalogSegment } from '@/lib/webPlansCatalogSegment'
import type { WebPlanCatalogSegment } from '@/types/database'

const SEGMENT_SEQUENCE: WebPlanCatalogSegment[] = [
  'solo',
  'with_nutritionist',
  'psychologist',
  'full_trio',
  'full',
]

export function compareBySegmentSortOrder(
  a: { sort_order?: number; sortOrder?: number; slug?: string; id?: string; name?: string },
  b: { sort_order?: number; sortOrder?: number; slug?: string; id?: string; name?: string },
): number {
  const oa = a.sort_order ?? a.sortOrder ?? 9999
  const ob = b.sort_order ?? b.sortOrder ?? 9999
  if (oa !== ob) return oa - ob
  const ka = a.slug ?? a.id ?? a.name ?? ''
  const kb = b.slug ?? b.id ?? b.name ?? ''
  return ka.localeCompare(kb, 'es', { sensitivity: 'base' })
}

function slugOrdersEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i])
}

/**
 * Asigna `sort_order` 1…n según el orden de la lista visible en Planes Web (orden global).
 * En /form, cada modalidad muestra sus planes en el mismo orden relativo que en esta lista.
 */
export function applyPlanSortOrderBySegment<T extends { slug: string; catalog_segment: string; sort_order: number }>(
  plans: T[],
  orderedVisibleSlugs: string[],
): T[] {
  const orderMap = new Map<string, number>()
  orderedVisibleSlugs.forEach((slug, i) => orderMap.set(slug, i + 1))

  let tail = orderedVisibleSlugs.length
  const hidden = plans
    .filter((p) => !orderMap.has(p.slug))
    .sort(compareBySegmentSortOrder)
  for (const p of hidden) {
    tail += 1
    orderMap.set(p.slug, tail)
  }

  return plans.map((p) => ({
    ...p,
    sort_order: orderMap.get(p.slug) ?? p.sort_order,
  }))
}

/** Posición dentro de su modalidad según el orden de la lista (1 = primero en /form en esa pestaña). */
export function segmentRankInVisibleList(
  orderedVisibleSlugs: string[],
  plansBySlug: Map<string, { catalog_segment: string }>,
  slug: string,
): number {
  const seg = normalizeWebPlanCatalogSegment(
    String(plansBySlug.get(slug)?.catalog_segment ?? 'solo'),
  )
  let rank = 0
  for (const s of orderedVisibleSlugs) {
    const row = plansBySlug.get(s)
    if (!row) continue
    if (normalizeWebPlanCatalogSegment(row.catalog_segment) !== seg) continue
    rank += 1
    if (s === slug) return rank
  }
  return rank
}

export { slugOrdersEqual, SEGMENT_SEQUENCE }

export function sortIntakePlansBySegmentSortOrder<
  T extends { sortOrder?: number; id: string; name: string },
>(items: T[]): T[] {
  return [...items].sort(compareBySegmentSortOrder)
}

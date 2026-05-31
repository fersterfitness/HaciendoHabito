import type { WebPlanCatalogSegment } from '@/types/database'

const VALID_SEGMENTS = new Set<WebPlanCatalogSegment>([
  'solo',
  'with_nutritionist',
  'full',
  'full_trio',
  'psychologist',
])

/** Normaliza valores legacy de BD a los segmentos usados en la app. */
export function normalizeWebPlanCatalogSegment(raw: string | null | undefined): WebPlanCatalogSegment {
  const seg = (raw ?? 'solo').trim()
  if (seg === 'with_cris' || seg === 'cris_solo') return 'with_nutritionist'
  if (VALID_SEGMENTS.has(seg as WebPlanCatalogSegment)) return seg as WebPlanCatalogSegment
  return 'solo'
}

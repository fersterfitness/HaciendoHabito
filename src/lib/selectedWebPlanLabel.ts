/** Slugs históricos del intake antes de unificar nombres en `web_plans`. */
const LEGACY_SELECTED_WEB_PLAN_LABELS: Record<string, string> = {
  'plan-entrenamiento': 'Plan Entrenamiento',
  'plan-nutricion': 'Plan Nutrición',
  'plan-full': 'Plan Full',
}

/** Etiqueta del plan elegido en /form (`students.selected_web_plan_slug`). */
export function labelForSelectedWebPlanSlug(
  slug: string | null | undefined,
  titlesBySlug: Map<string, string>,
): string | null {
  const key = slug?.trim()
  if (!key) return null
  const fromDb = titlesBySlug.get(key)?.trim()
  if (fromDb) return fromDb
  return LEGACY_SELECTED_WEB_PLAN_LABELS[key] ?? key
}

import type {
  WebPlanCatalogSegment,
  WebPlanIncludeProfessional,
  WebPlanIncludeSection,
} from '@/types/database'

export type { WebPlanIncludeProfessional, WebPlanIncludeSection }

export const WEB_PLAN_INCLUDE_PROFESSIONAL_ORDER: WebPlanIncludeProfessional[] = [
  'trainer',
  'psychologist',
  'nutritionist',
]

/** Metadatos y colores para tildes y títulos: Entrenador = secondary, Nutricionista = tertiary, Psicólogo = cyan. */
export const WEB_PLAN_PROFESSIONAL_META: Record<
  WebPlanIncludeProfessional,
  {
    label: string
    checkClassDark: string
    checkClassLight: string
    headingClassDark: string
    headingClassLight: string
    chipClass: string
  }
> = {
  trainer: {
    label: 'Entrenador',
    checkClassDark: 'text-brand-secondary',
    checkClassLight: 'text-brand-secondary',
    headingClassDark: 'text-brand-secondary',
    headingClassLight: 'text-brand-secondary',
    chipClass: 'border-brand-secondary/35 bg-brand-secondary/10 text-brand-secondary',
  },
  psychologist: {
    label: 'Psicólogo',
    checkClassDark: 'text-cyan-400',
    checkClassLight: 'text-cyan-600',
    headingClassDark: 'text-cyan-400',
    headingClassLight: 'text-cyan-600',
    chipClass: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  },
  nutritionist: {
    label: 'Nutricionista',
    checkClassDark: 'text-brand-tertiary',
    checkClassLight: 'text-brand-tertiary',
    headingClassDark: 'text-brand-tertiary',
    headingClassLight: 'text-brand-tertiary',
    chipClass: 'border-brand-tertiary/35 bg-brand-tertiary/10 text-brand-tertiary',
  },
}

const VALID_PROFESSIONALS = new Set<string>(WEB_PLAN_INCLUDE_PROFESSIONAL_ORDER)

export function isWebPlanIncludeProfessional(v: string): v is WebPlanIncludeProfessional {
  return VALID_PROFESSIONALS.has(v)
}

export function defaultProfessionalForSegment(segment: WebPlanCatalogSegment): WebPlanIncludeProfessional {
  if (segment === 'with_nutritionist') return 'nutritionist'
  if (segment === 'full') return 'trainer'
  return 'trainer'
}

export function parseItemsMultiline(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function flattenIncludeSections(sections: WebPlanIncludeSection[]): string[] {
  const out: string[] = []
  for (const s of sections) {
    for (const item of s.items) {
      const t = item.trim()
      if (t) out.push(t)
    }
  }
  return out
}

export function sectionsFromFlatItems(
  items: string[],
  defaultProfessional: WebPlanIncludeProfessional = 'trainer',
): WebPlanIncludeSection[] {
  const clean = items.map((i) => i.trim()).filter(Boolean)
  if (!clean.length) return []
  return [{ professional: defaultProfessional, items: clean }]
}

/** Normaliza desde JSON de BD, secciones en memoria o listado plano legacy. */
export function normalizeIncludeSections(
  sectionsRaw: unknown,
  flatItems: string[] | null | undefined,
  catalogSegment: WebPlanCatalogSegment = 'solo',
): WebPlanIncludeSection[] {
  const parsed = parseIncludeSectionsJson(sectionsRaw)
  if (parsed.length > 0) return parsed
  const flat = flatItems ?? []
  return sectionsFromFlatItems(flat, defaultProfessionalForSegment(catalogSegment))
}

export function parseIncludeSectionsJson(raw: unknown): WebPlanIncludeSection[] {
  if (!Array.isArray(raw)) return []
  const out: WebPlanIncludeSection[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const o = entry as Record<string, unknown>
    const pro = typeof o.professional === 'string' ? o.professional : ''
    if (!isWebPlanIncludeProfessional(pro)) continue
    const itemsRaw = o.items
    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map((x) => String(x).trim()).filter(Boolean)
      : []
    if (!items.length) continue
    out.push({ professional: pro, items })
  }
  return out
}

export function totalIncludeItemCount(sections: WebPlanIncludeSection[]): number {
  return flattenIncludeSections(sections).length
}

/** Secciones listas para la UI del formulario público (tarjeta / detalle). */
export type IntakeIncludeSectionView = {
  professional: WebPlanIncludeProfessional
  title: string
  items: string[]
  checkClassDark: string
  checkClassLight: string
  headingClassDark: string
  headingClassLight: string
}

export function toIntakeIncludeSectionViews(sections: WebPlanIncludeSection[]): IntakeIncludeSectionView[] {
  return sections.map((s) => {
    const meta = WEB_PLAN_PROFESSIONAL_META[s.professional]
    return {
      professional: s.professional,
      title: meta.label,
      items: s.items,
      checkClassDark: meta.checkClassDark,
      checkClassLight: meta.checkClassLight,
      headingClassDark: meta.headingClassDark,
      headingClassLight: meta.headingClassLight,
    }
  })
}

export function availableProfessionalsToAdd(
  sections: WebPlanIncludeSection[],
): WebPlanIncludeProfessional[] {
  const used = new Set(sections.map((s) => s.professional))
  return WEB_PLAN_INCLUDE_PROFESSIONAL_ORDER.filter((p) => !used.has(p))
}

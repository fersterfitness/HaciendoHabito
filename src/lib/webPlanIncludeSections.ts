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

/** Metadatos por rol: tonos neutros en /form; la barra lateral distingue sin violeta/cyan. */
export const WEB_PLAN_PROFESSIONAL_META: Record<
  WebPlanIncludeProfessional,
  {
    label: string
    checkClassDark: string
    checkClassLight: string
    headingClassDark: string
    headingClassLight: string
    chipClass: string
    accentBarClassDark: string
    accentBarClassLight: string
  }
> = {
  trainer: {
    label: 'Entrenador',
    checkClassDark: 'text-emerald-400/75',
    checkClassLight: 'text-emerald-600/85',
    headingClassDark: 'text-white/80',
    headingClassLight: 'text-neutral-700',
    chipClass: 'border-white/15 bg-white/[0.04] text-white/75',
    accentBarClassDark: 'border-l-zinc-400/55',
    accentBarClassLight: 'border-l-neutral-400',
  },
  psychologist: {
    label: 'Psicólogo',
    checkClassDark: 'text-emerald-400/75',
    checkClassLight: 'text-emerald-600/85',
    headingClassDark: 'text-white/80',
    headingClassLight: 'text-neutral-700',
    chipClass: 'border-white/15 bg-white/[0.04] text-white/75',
    accentBarClassDark: 'border-l-zinc-500/50',
    accentBarClassLight: 'border-l-neutral-500',
  },
  nutritionist: {
    label: 'Nutricionista',
    checkClassDark: 'text-emerald-400/75',
    checkClassLight: 'text-emerald-600/85',
    headingClassDark: 'text-white/80',
    headingClassLight: 'text-neutral-700',
    chipClass: 'border-white/15 bg-white/[0.04] text-white/75',
    accentBarClassDark: 'border-l-zinc-300/45',
    accentBarClassLight: 'border-l-neutral-300',
  },
}

const VALID_PROFESSIONALS = new Set<string>(WEB_PLAN_INCLUDE_PROFESSIONAL_ORDER)

export function isWebPlanIncludeProfessional(v: string): v is WebPlanIncludeProfessional {
  return VALID_PROFESSIONALS.has(v)
}

export function defaultProfessionalForSegment(segment: WebPlanCatalogSegment): WebPlanIncludeProfessional {
  if (segment === 'with_nutritionist') return 'nutritionist'
  if (segment === 'psychologist') return 'psychologist'
  if (segment === 'full' || segment === 'full_trio') return 'trainer'
  return 'trainer'
}

const SINGLE_PROFESSIONAL_MODALITIES: WebPlanCatalogSegment[] = [
  'solo',
  'with_nutritionist',
  'psychologist',
]

/**
 * En modalidades de un solo rol, la sección «Incluye» debe mostrar ese profesional
 * (p. ej. psicólogo + foto de Santiago, no entrenador por defecto del borrador).
 */
export function alignIncludeSectionsToCatalogSegment(
  sections: WebPlanIncludeSection[],
  catalogSegment: WebPlanCatalogSegment,
): WebPlanIncludeSection[] {
  if (!sections.length || !SINGLE_PROFESSIONAL_MODALITIES.includes(catalogSegment)) return sections
  const defaultPro = defaultProfessionalForSegment(catalogSegment)
  if (sections.length === 1) {
    const only = sections[0]!
    if (only.professional === defaultPro) return sections
    return [{ ...only, professional: defaultPro }]
  }
  return sections
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
  const base =
    parsed.length > 0
      ? parsed
      : sectionsFromFlatItems(flatItems ?? [], defaultProfessionalForSegment(catalogSegment))
  return alignIncludeSectionsToCatalogSegment(base, catalogSegment)
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
  accentBarClassDark: string
  accentBarClassLight: string
  /** Foto del profesional (formulario público). */
  avatarUrl?: string | null
  /** Credencial corta bajo el título (opcional). */
  subtitle?: string
}

export type IntakeIncludeSectionAvatarMap = Partial<
  Record<WebPlanIncludeProfessional, { avatarUrl: string | null; subtitle?: string }>
>

export function attachAvatarsToIncludeSectionViews(
  views: IntakeIncludeSectionView[],
  avatars: IntakeIncludeSectionAvatarMap,
): IntakeIncludeSectionView[] {
  return views.map((view) => {
    const extra = avatars[view.professional]
    if (!extra) return view
    return {
      ...view,
      avatarUrl: extra.avatarUrl,
      subtitle: extra.subtitle?.trim() || undefined,
    }
  })
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
      accentBarClassDark: meta.accentBarClassDark,
      accentBarClassLight: meta.accentBarClassLight,
    }
  })
}

export function availableProfessionalsToAdd(
  sections: WebPlanIncludeSection[],
): WebPlanIncludeProfessional[] {
  const used = new Set(sections.map((s) => s.professional))
  return WEB_PLAN_INCLUDE_PROFESSIONAL_ORDER.filter((p) => !used.has(p))
}

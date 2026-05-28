import { profileAvatarDisplayUrl } from '@/lib/profileAvatar'
import type { WebPlanCatalogSegment } from '@/types/database'

/** Profesional visible en /form (selector + asignación de owner al enviar). */
export type IntakeProfessional = {
  slug: string
  profileId: string | null
  fullName: string
  /** Credencial corta; no incluye el nombre (ya está en fullName). */
  credentialLine: string
  role: 'trainer' | 'nutritionist'
  /** Foto de perfil (bucket profile-avatars). */
  avatarUrl?: string | null
}

export const INTAKE_TRAINER_SLUG_DEFAULT = 'tomas-ferster'
export const INTAKE_NUTRITION_SLUG_DEFAULT = 'cris-crossetto'

const DEFAULT_TRAINER_CREDENTIAL =
  'Lic. alto rendimiento (est.) · Prof. Educación física · Esp. deportiva'
const DEFAULT_NUTRITION_CREDENTIAL = 'Lic. en Nutrición · Especialización deportiva'

export const DEFAULT_INTAKE_TRAINERS: IntakeProfessional[] = [
  {
    slug: INTAKE_TRAINER_SLUG_DEFAULT,
    profileId: null,
    fullName: 'Tomás Ferster',
    credentialLine: DEFAULT_TRAINER_CREDENTIAL,
    role: 'trainer',
  },
]

export const DEFAULT_INTAKE_NUTRITIONISTS: IntakeProfessional[] = [
  {
    slug: INTAKE_NUTRITION_SLUG_DEFAULT,
    profileId: null,
    fullName: 'Cristian Crossetto',
    credentialLine: DEFAULT_NUTRITION_CREDENTIAL,
    role: 'nutritionist',
  },
]

export type PublicIntakeProfessionalRow = {
  id: string
  public_intake_slug: string
  full_name: string
  role: string
  intake_credential_line: string | null
  avatar_url: string | null
}

function roleToIntakeRole(role: string): 'trainer' | 'nutritionist' | null {
  if (role === 'nutritionist') return 'nutritionist'
  if (role === 'trainer' || role === 'admin') return 'trainer'
  return null
}

function mergeProfessionals(
  defaults: IntakeProfessional[],
  rows: PublicIntakeProfessionalRow[],
  intakeRole: 'trainer' | 'nutritionist',
): IntakeProfessional[] {
  const bySlug = new Map<string, PublicIntakeProfessionalRow>()
  for (const row of rows) {
    const mapped = roleToIntakeRole(row.role)
    if (mapped !== intakeRole) continue
    bySlug.set(row.public_intake_slug, row)
  }

  const merged = defaults.map((d) => {
    const row = bySlug.get(d.slug)
    if (!row) return d
    return {
      ...d,
      profileId: row.id,
      fullName: row.full_name.trim() || d.fullName,
      credentialLine: row.intake_credential_line?.trim() || d.credentialLine,
      avatarUrl: profileAvatarDisplayUrl(row.avatar_url) ?? d.avatarUrl ?? null,
    }
  })

  for (const row of rows) {
    if (roleToIntakeRole(row.role) !== intakeRole) continue
    if (merged.some((m) => m.slug === row.public_intake_slug)) continue
    merged.push({
      slug: row.public_intake_slug,
      profileId: row.id,
      fullName: row.full_name.trim() || row.public_intake_slug,
      credentialLine: row.intake_credential_line?.trim() || '',
      role: intakeRole,
      avatarUrl: profileAvatarDisplayUrl(row.avatar_url),
    })
  }

  return merged
}

export function mergeIntakeTrainersFromDb(rows: PublicIntakeProfessionalRow[]): IntakeProfessional[] {
  return mergeProfessionals(DEFAULT_INTAKE_TRAINERS, rows, 'trainer')
}

export function mergeIntakeNutritionistsFromDb(rows: PublicIntakeProfessionalRow[]): IntakeProfessional[] {
  return mergeProfessionals(DEFAULT_INTAKE_NUTRITIONISTS, rows, 'nutritionist')
}

const EMAIL_LIKE_NAME_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Nombre visible en /form; evita mostrar el mail del perfil si vino mal cargado en BD. */
export function intakeProfessionalPublicName(pro: IntakeProfessional): string {
  const raw = pro.fullName.trim()
  if (raw && !EMAIL_LIKE_NAME_RE.test(raw)) return raw
  const fallback =
    pro.role === 'trainer'
      ? DEFAULT_INTAKE_TRAINERS.find((d) => d.slug === pro.slug)?.fullName
      : DEFAULT_INTAKE_NUTRITIONISTS.find((d) => d.slug === pro.slug)?.fullName
  if (fallback?.trim()) return fallback.trim()
  return pro.slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function findIntakeProfessional(
  list: IntakeProfessional[],
  slug: string | null | undefined,
): IntakeProfessional | null {
  if (!slug) return list[0] ?? null
  return list.find((p) => p.slug === slug) ?? list[0] ?? null
}

/** Línea de detalle de plan Full sin repetir nombres en el bloque de credencial. */
export function fullPlanCredentialLine(
  trainer: IntakeProfessional | null,
  nutritionist: IntakeProfessional | null,
): string {
  const t = trainer?.fullName?.trim()
  const n = nutritionist?.fullName?.trim()
  if (t && n) return `Plan integral con ${t} y ${n}`
  return 'Entrenamiento y nutrición en un mismo plan'
}

export type IntakeCatalogSegmentImages = {
  solo: string | null
  withNutritionist: string | null
  crisSolo: string | null
  psychologist: string | null
}

/** Foto visible en /form: catálogo del panel (si hay URL) + avatar de perfil. */
export function intakeProfessionalDisplayAvatar(
  pro: IntakeProfessional,
  opts: {
    catalogImages: IntakeCatalogSegmentImages
    modalitySegment?: WebPlanCatalogSegment
  },
): string | null {
  if (pro.role === 'trainer' && pro.slug === INTAKE_TRAINER_SLUG_DEFAULT) {
    return opts.catalogImages.solo ?? pro.avatarUrl ?? null
  }

  if (pro.role === 'nutritionist' && pro.slug === INTAKE_NUTRITION_SLUG_DEFAULT) {
    const nutritionCatalog =
      opts.modalitySegment === 'with_nutritionist'
        ? opts.catalogImages.crisSolo ?? opts.catalogImages.withNutritionist
        : opts.catalogImages.withNutritionist
    return nutritionCatalog ?? pro.avatarUrl ?? null
  }

  return pro.avatarUrl ?? null
}

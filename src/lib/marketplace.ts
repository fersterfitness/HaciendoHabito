/**
 * Marketplace de profesionales: tipos y catálogos chicos (roles, deportes, duraciones).
 * Los profesionales y sus planes viven en la base (`marketplace_*`); acá no se carga ninguno a mano.
 */

export type MarketplaceRole = 'entrenador' | 'nutricionista' | 'psicologo' | 'kinesiologo'
export type MarketplaceModality = 'online' | 'presencial'
export type MarketplaceDuration = 'mensual' | 'x3' | 'x6' | 'anual'
export type MarketplaceProfessionalStatus = 'borrador' | 'pendiente' | 'aprobado' | 'oculto'
export type MarketplaceRequestStatus = 'nueva' | 'contactada' | 'aceptada' | 'descartada'

export interface MarketplaceProfessional {
  id: string
  /** Cuenta del propio profesional, si la tiene. */
  user_id: string | null
  /** Quién cargó el perfil y lo administra. */
  managed_by?: string | null
  slug: string
  nombre: string
  rol: MarketplaceRole
  deportes: string[]
  especialidades: string[]
  foto_url: string | null
  bio: string
  ubicacion: string
  modalidad: MarketplaceModality[]
  whatsapp: string
  verificado: boolean
  destacado: boolean
  estado: MarketplaceProfessionalStatus
  created_at: string
  updated_at: string
}

/** Cuenta de la app que se le creó (o vinculó) a un perfil. Fila de `marketplace_access`. */
export interface MarketplaceAccess {
  professional_id: string
  user_id: string
  email: string
  /** true: la cuenta nació con la invitación · false: ya existía y solo se vinculó. */
  created_account: boolean
  invited_at: string
  activated_at: string | null
}

/** Quién maneja el perfil, para mostrarlo en una pastilla. */
export type MarketplaceAccessState = 'sin-cuenta' | 'invitado' | 'activa' | 'propia'

/** Roles del marketplace que tienen app (el resto solo puede tener perfil público). */
export const MARKETPLACE_ROLES_WITH_APP: MarketplaceRole[] = ['entrenador', 'nutricionista', 'psicologo']

export interface MarketplacePlan {
  id: string
  professional_id: string
  titulo: string
  descripcion: string
  precio: number
  duracion: MarketplaceDuration
  modalidad: MarketplaceModality | null
  incluye: string[]
  cupos: number | null
  activo: boolean
  orden: number
}

/** Fila de la vista `marketplace_directory` (tarjeta del directorio). */
export interface MarketplaceDirectoryRow {
  id: string
  slug: string
  nombre: string
  rol: MarketplaceRole
  deportes: string[]
  especialidades: string[]
  foto_url: string | null
  ubicacion: string
  modalidad: MarketplaceModality[]
  verificado: boolean
  destacado: boolean
  precio_desde: number
  planes_activos: number
}

export interface MarketplaceRequest {
  id: string
  group_id: string
  professional_id: string
  plan_id: string | null
  plan_titulo: string
  plan_precio: number
  plan_duracion: MarketplaceDuration
  cliente_nombre: string
  cliente_whatsapp: string
  cliente_email: string
  deporte: string
  objetivo: string
  equipo_resumen: string
  estado: MarketplaceRequestStatus
  created_at: string
}

export interface MarketplaceApplication {
  id: string
  nombre: string
  rol: MarketplaceRole
  email: string
  whatsapp: string
  deportes: string
  mensaje: string
  estado: 'nueva' | 'resuelta'
  created_at: string
}

export const MARKETPLACE_ROLES: { value: MarketplaceRole; label: string; plural: string; area: string }[] = [
  { value: 'entrenador', label: 'Entrenador', plural: 'Entrenadores', area: 'Entrenamiento' },
  { value: 'nutricionista', label: 'Nutricionista', plural: 'Nutricionistas', area: 'Nutrición' },
  { value: 'psicologo', label: 'Psicólogo deportivo', plural: 'Psicólogos', area: 'Psicología' },
  { value: 'kinesiologo', label: 'Kinesiólogo', plural: 'Kinesiólogos', area: 'Kinesiología' },
]

const ROLE_BY_VALUE = new Map(MARKETPLACE_ROLES.map((r) => [r.value, r]))

export const roleLabel = (rol: MarketplaceRole) => ROLE_BY_VALUE.get(rol)?.label ?? rol
export const roleArea = (rol: MarketplaceRole) => ROLE_BY_VALUE.get(rol)?.area ?? rol

/** Deportes que se pueden elegir (se guardan con este `value`). */
export const MARKETPLACE_SPORTS: { value: string; label: string }[] = [
  { value: 'boxeo', label: 'Boxeo' },
  { value: 'artes-marciales', label: 'Artes marciales' },
  { value: 'futbol', label: 'Fútbol' },
  { value: 'basquet', label: 'Básquet' },
  { value: 'running', label: 'Running' },
  { value: 'fisicoculturismo', label: 'Fisicoculturismo' },
  { value: 'musculacion', label: 'Musculación' },
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'rugby', label: 'Rugby' },
  { value: 'hockey', label: 'Hockey' },
  { value: 'tenis', label: 'Tenis y pádel' },
  { value: 'natacion', label: 'Natación' },
  { value: 'ciclismo', label: 'Ciclismo' },
  { value: 'voley', label: 'Vóley' },
  { value: 'salud', label: 'Salud y bienestar' },
]

const SPORT_BY_VALUE = new Map(MARKETPLACE_SPORTS.map((s) => [s.value, s.label]))

export const sportLabel = (value: string) => SPORT_BY_VALUE.get(value) ?? value

export const MARKETPLACE_DURATIONS: { value: MarketplaceDuration; label: string; per: string }[] = [
  { value: 'mensual', label: 'Mensual', per: 'por mes' },
  { value: 'x3', label: '3 meses', per: 'por 3 meses' },
  { value: 'x6', label: '6 meses', per: 'por 6 meses' },
  { value: 'anual', label: 'Anual', per: 'por año' },
]

const DURATION_BY_VALUE = new Map(MARKETPLACE_DURATIONS.map((d) => [d.value, d]))

export const durationLabel = (d: MarketplaceDuration) => DURATION_BY_VALUE.get(d)?.label ?? d
export const durationPer = (d: MarketplaceDuration) => DURATION_BY_VALUE.get(d)?.per ?? ''

export const modalityLabel = (m: MarketplaceModality[]) =>
  m.length === 2 ? 'Online y presencial' : m[0] === 'online' ? 'Online' : m[0] === 'presencial' ? 'Presencial' : ''

/** «$50.000»: pesos sin decimales. */
export function formatPrice(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

/** Profesionales por página en el directorio. */
export const DIRECTORY_PAGE_SIZE = 9

export const PRICE_RANGES: { value: string; label: string; min?: number; max?: number }[] = [
  { value: '', label: 'Cualquier precio' },
  { value: 'hasta-40', label: 'Hasta $40.000', max: 40000 },
  { value: '40-70', label: '$40.000 a $70.000', min: 40000, max: 70000 },
  { value: 'mas-70', label: 'Más de $70.000', min: 70000 },
]

export type DirectorySort = 'destacados' | 'precio-asc' | 'precio-desc'

export type DirectoryFilters = {
  q: string
  rol: MarketplaceRole | ''
  deporte: string
  modalidad: MarketplaceModality | ''
  precio: string
  orden: DirectorySort
  page: number
}

/** Solo dígitos, para armar el link de WhatsApp (`wa.me`). */
export function whatsappDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

export function whatsappLink(raw: string, text?: string): string | null {
  const digits = whatsappDigits(raw)
  if (!digits) return null
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** Slug para la dirección pública: minúsculas, sin acentos, con guiones. */
export function marketplaceSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Rol del marketplace sugerido según el rol de la cuenta. */
export function defaultMarketplaceRole(appRole: string | undefined): MarketplaceRole {
  if (appRole === 'nutritionist') return 'nutricionista'
  if (appRole === 'psychologist') return 'psicologo'
  return 'entrenador'
}

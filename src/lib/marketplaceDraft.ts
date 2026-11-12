/**
 * Borrador del formulario de un profesional del marketplace y lo que el panel recuerda entre pantallas.
 * Vive en sessionStorage: sobrevive a cambiar de pestaña o recargar, y se va al cerrar la ventana.
 */
import {
  marketplaceSlug,
  type MarketplaceAccessState,
  type MarketplaceApplication,
  type MarketplaceModality,
  type MarketplaceProfessional,
  type MarketplaceRole,
} from '@/lib/marketplace'

export type ProfileDraft = {
  nombre: string
  slug: string
  slugTouched: boolean
  rol: MarketplaceRole
  deportes: string[]
  especialidades: string
  modalidad: MarketplaceModality[]
  ubicacion: string
  whatsapp: string
  bio: string
  fotoUrl: string | null
  /** Solo al dar de alta: quién va a manejar el perfil. */
  cuenta: 'yo' | 'propia'
  /** Correo con el que va a entrar, si tiene cuenta propia. */
  email: string
  /** Nombre de quien se postuló en /sumate, si el alta sale de una postulación. */
  postulacion?: string
}

/** Qué profesional se está editando (un id, 'new' o nada = la lista). */
export const SELECTED_KEY = 'hh-mkt-selected'

const draftKey = (id: string | null) => `hh-mkt-draft-${id ?? 'new'}`

export function initialDraft(p: MarketplaceProfessional | null): ProfileDraft {
  return {
    nombre: p?.nombre ?? '',
    slug: p?.slug ?? '',
    slugTouched: Boolean(p),
    rol: p?.rol ?? 'entrenador',
    deportes: p?.deportes ?? [],
    especialidades: (p?.especialidades ?? []).join(', '),
    modalidad: p?.modalidad ?? ['online'],
    ubicacion: p?.ubicacion ?? '',
    whatsapp: p?.whatsapp ?? '',
    bio: p?.bio ?? '',
    fotoUrl: p?.foto_url ?? null,
    cuenta: 'yo',
    email: '',
  }
}

export function readDraft(id: string | null): ProfileDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(id))
    // Borradores viejos no traen `cuenta` ni `email`: se completan con lo de base.
    return raw ? { ...initialDraft(null), ...(JSON.parse(raw) as Partial<ProfileDraft>) } : null
  } catch {
    return null
  }
}

export function writeDraft(id: string | null, draft: ProfileDraft) {
  try {
    sessionStorage.setItem(draftKey(id), JSON.stringify(draft))
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
}

export function clearDraft(id: string | null) {
  try {
    sessionStorage.removeItem(draftKey(id))
  } catch {
    /* sin almacenamiento */
  }
}

/** Deja listo el alta de un profesional con los datos que dejó en /sumate. */
export function seedDraftFromApplication(app: MarketplaceApplication) {
  writeDraft(null, {
    ...initialDraft(null),
    nombre: app.nombre,
    slug: marketplaceSlug(app.nombre),
    rol: app.rol,
    whatsapp: app.whatsapp,
    cuenta: 'propia',
    email: app.email,
    postulacion: app.nombre,
  })
  try {
    sessionStorage.setItem(SELECTED_KEY, 'new')
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Link de invitación recién generado, por profesional. Solo en memoria: sirve una vez y no se
 * guarda en ningún lado; si se pierde, se genera otro.
 */
export const inviteMemo = new Map<string, { link: string | null; email: string }>()

export function accessState(
  p: Pick<MarketplaceProfessional, 'user_id'> & { access: { activated_at: string | null; created_account: boolean } | null },
  myId: string | undefined,
): MarketplaceAccessState {
  if (p.user_id && p.user_id === myId) return 'propia'
  if (p.access && p.access.created_account && !p.access.activated_at) return 'invitado'
  if (p.user_id) return 'activa'
  return 'sin-cuenta'
}

export const ACCESS_LABEL: Record<MarketplaceAccessState, string> = {
  'sin-cuenta': 'Lo manejás vos',
  invitado: 'Invitación sin usar',
  activa: 'Con cuenta propia',
  propia: 'Tu perfil',
}

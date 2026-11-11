/**
 * Datos del marketplace de profesionales (`marketplace_*`).
 * Lo público va con el cliente anónimo (`supabasePublic`); el panel, con la sesión del profesional.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import {
  DIRECTORY_PAGE_SIZE,
  PRICE_RANGES,
  type DirectoryFilters,
  type MarketplaceApplication,
  type MarketplaceDirectoryRow,
  type MarketplacePlan,
  type MarketplaceProfessional,
  type MarketplaceProfessionalStatus,
  type MarketplaceRequest,
  type MarketplaceRequestStatus,
  type MarketplaceRole,
} from '@/lib/marketplace'

const DIRECTORY_COLUMNS =
  'id, slug, nombre, rol, deportes, especialidades, foto_url, ubicacion, modalidad, verificado, destacado, precio_desde, planes_activos'
const PLAN_COLUMNS = 'id, professional_id, titulo, descripcion, precio, duracion, modalidad, incluye, cupos, activo, orden'

/** Caracteres que rompen un filtro `ilike` de PostgREST o actúan de comodín. */
const cleanSearch = (q: string) => q.toLowerCase().replace(/[%_,()*\\]/g, ' ').replace(/\s+/g, ' ').trim()

// ───────────────────────── Público ─────────────────────────

export function useDirectory(filters: DirectoryFilters) {
  return useQuery({
    queryKey: ['marketplace', 'directory', filters],
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      let query = supabasePublic.from('marketplace_directory').select(DIRECTORY_COLUMNS, { count: 'exact' })

      const q = cleanSearch(filters.q)
      if (q) query = query.ilike('busqueda', `%${q}%`)
      if (filters.rol) query = query.eq('rol', filters.rol)
      if (filters.deporte) query = query.contains('deportes', [filters.deporte])
      if (filters.modalidad) query = query.contains('modalidad', [filters.modalidad])
      const range = PRICE_RANGES.find((r) => r.value === filters.precio)
      if (range?.min !== undefined) query = query.gte('precio_desde', range.min)
      if (range?.max !== undefined) query = query.lte('precio_desde', range.max)

      if (filters.orden === 'precio-asc') query = query.order('precio_desde', { ascending: true })
      else if (filters.orden === 'precio-desc') query = query.order('precio_desde', { ascending: false })
      else query = query.order('destacado', { ascending: false }).order('verificado', { ascending: false })
      query = query.order('nombre', { ascending: true })

      const from = (filters.page - 1) * DIRECTORY_PAGE_SIZE
      const { data, error, count } = await query.range(from, from + DIRECTORY_PAGE_SIZE - 1)
      if (error) throw error
      return { rows: (data ?? []) as MarketplaceDirectoryRow[], total: count ?? 0 }
    },
  })
}

/** Página pública de un profesional: sus datos y solo sus planes activos. */
export function usePublicProfessional(slug: string | undefined) {
  return useQuery({
    queryKey: ['marketplace', 'public-professional', slug],
    enabled: Boolean(slug),
    staleTime: 60_000,
    queryFn: async () => {
      const { data: professional, error } = await supabasePublic
        .from('marketplace_professionals')
        .select('*')
        .eq('slug', slug!)
        .eq('estado', 'aprobado')
        .maybeSingle()
      if (error) throw error
      if (!professional) return null
      const { data: plans, error: plansError } = await supabasePublic
        .from('marketplace_plans')
        .select(PLAN_COLUMNS)
        .eq('professional_id', (professional as MarketplaceProfessional).id)
        .eq('activo', true)
        .order('orden', { ascending: true })
        .order('precio', { ascending: true })
      if (plansError) throw plansError
      return { professional: professional as MarketplaceProfessional, plans: (plans ?? []) as MarketplacePlan[] }
    },
  })
}

/** Planes del equipo tal como están hoy (precio actualizado; los que faltan ya no están disponibles). */
export function useTeamPlans(planIds: string[]) {
  const ids = [...planIds].sort()
  return useQuery({
    queryKey: ['marketplace', 'team-plans', ids],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabasePublic.from('marketplace_plans').select(PLAN_COLUMNS).in('id', ids)
      if (error) throw error
      return (data ?? []) as MarketplacePlan[]
    },
  })
}

export type TeamRequestInput = {
  planIds: string[]
  nombre: string
  whatsapp: string
  email: string
  deporte: string
  objetivo: string
}

export async function submitTeamRequest(input: TeamRequestInput): Promise<string> {
  const { data, error } = await supabasePublic.rpc('submit_marketplace_request', {
    p_plan_ids: input.planIds,
    p_nombre: input.nombre,
    p_whatsapp: input.whatsapp,
    p_email: input.email,
    p_deporte: input.deporte,
    p_objetivo: input.objetivo,
  })
  if (error) throw error
  return data as string
}

export type ApplicationInput = {
  nombre: string
  rol: MarketplaceRole
  email: string
  whatsapp: string
  deportes: string
  mensaje: string
}

export async function submitApplication(input: ApplicationInput): Promise<void> {
  const { error } = await supabasePublic.rpc('submit_marketplace_application', {
    p_nombre: input.nombre,
    p_rol: input.rol,
    p_email: input.email,
    p_whatsapp: input.whatsapp,
    p_deportes: input.deportes,
    p_mensaje: input.mensaje,
  })
  if (error) throw error
}

// ───────────────────────── Panel del profesional ─────────────────────────

const myKey = (userId: string | undefined) => ['marketplace', 'mine', userId] as const

export type MyMarketplace = {
  professional: MarketplaceProfessional | null
  plans: MarketplacePlan[]
  requests: MarketplaceRequest[]
}

export function useMyMarketplace(userId: string | undefined) {
  return useQuery({
    queryKey: myKey(userId),
    enabled: Boolean(userId),
    staleTime: 15_000,
    queryFn: async (): Promise<MyMarketplace> => {
      const { data: professional, error } = await supabase
        .from('marketplace_professionals')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      if (!professional) return { professional: null, plans: [], requests: [] }
      const id = (professional as MarketplaceProfessional).id
      const [plans, requests] = await Promise.all([
        supabase.from('marketplace_plans').select(PLAN_COLUMNS).eq('professional_id', id).order('orden').order('created_at'),
        supabase
          .from('marketplace_requests')
          .select('*')
          .eq('professional_id', id)
          .order('created_at', { ascending: false })
          .limit(200),
      ])
      if (plans.error) throw plans.error
      if (requests.error) throw requests.error
      return {
        professional: professional as MarketplaceProfessional,
        plans: (plans.data ?? []) as MarketplacePlan[],
        requests: (requests.data ?? []) as MarketplaceRequest[],
      }
    },
  })
}

export type ProfessionalInput = Pick<
  MarketplaceProfessional,
  'slug' | 'nombre' | 'rol' | 'deportes' | 'especialidades' | 'foto_url' | 'bio' | 'ubicacion' | 'modalidad' | 'whatsapp'
> & { estado?: MarketplaceProfessionalStatus }

export function useSaveMyProfessional(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: ProfessionalInput }) => {
      const res = id
        ? await supabase.from('marketplace_professionals').update(input).eq('id', id)
        : await supabase.from('marketplace_professionals').insert({ ...input, user_id: userId! })
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace'] }),
  })
}

export type PlanInput = Omit<MarketplacePlan, 'id' | 'professional_id'>

export function useSavePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, professionalId, input }: { id: string | null; professionalId: string; input: Partial<PlanInput> }) => {
      const res = id
        ? await supabase.from('marketplace_plans').update(input).eq('id', id)
        : await supabase.from('marketplace_plans').insert({ ...input, professional_id: professionalId })
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace'] }),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketplace_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace'] }),
  })
}

export function useSetRequestStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: MarketplaceRequestStatus }) => {
      const { error } = await supabase.from('marketplace_requests').update({ estado }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace'] }),
  })
}

// ───────────────────────── Admin ─────────────────────────

export type AdminProfessionalRow = MarketplaceProfessional & { planes: number; precio_desde: number | null }

export function useAdminMarketplace(enabled: boolean) {
  return useQuery({
    queryKey: ['marketplace', 'admin'],
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      const [professionals, plans, applications] = await Promise.all([
        supabase.from('marketplace_professionals').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('marketplace_plans').select('professional_id, precio, activo').limit(5000),
        supabase.from('marketplace_applications').select('*').order('created_at', { ascending: false }).limit(200),
      ])
      if (professionals.error) throw professionals.error
      if (plans.error) throw plans.error
      if (applications.error) throw applications.error

      const byProfessional = new Map<string, { planes: number; desde: number | null }>()
      for (const p of (plans.data ?? []) as Pick<MarketplacePlan, 'professional_id' | 'precio' | 'activo'>[]) {
        if (!p.activo) continue
        const cur = byProfessional.get(p.professional_id) ?? { planes: 0, desde: null }
        cur.planes += 1
        cur.desde = cur.desde === null ? p.precio : Math.min(cur.desde, p.precio)
        byProfessional.set(p.professional_id, cur)
      }
      const rows: AdminProfessionalRow[] = ((professionals.data ?? []) as MarketplaceProfessional[]).map((p) => ({
        ...p,
        planes: byProfessional.get(p.id)?.planes ?? 0,
        precio_desde: byProfessional.get(p.id)?.desde ?? null,
      }))
      return { rows, applications: (applications.data ?? []) as MarketplaceApplication[] }
    },
  })
}

export function useAdminUpdateProfessional() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<MarketplaceProfessional, 'estado' | 'verificado' | 'destacado'>>
    }) => {
      const { error } = await supabase.from('marketplace_professionals').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace'] }),
  })
}

export function useResolveApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketplace_applications').update({ estado: 'resuelta' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace'] }),
  })
}

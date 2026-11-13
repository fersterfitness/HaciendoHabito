import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'

/**
 * «Casos de éxito» del perfil público de un profesional
 * (20261117120000_marketplace_cases_admin_new_students.sql): foto, video (link) o mensaje.
 */

export type MarketplaceCaseType = 'foto' | 'video' | 'mensaje'

export interface MarketplaceCase {
  id: string
  professional_id: string
  tipo: MarketplaceCaseType
  titulo: string
  texto: string
  media_url: string | null
  orden: number
  created_at: string
}

export const CASES_MIGRATION = '20261117120000_marketplace_cases_admin_new_students.sql'
export const MAX_CASES = 24

const COLUMNS = 'id, professional_id, tipo, titulo, texto, media_url, orden, created_at'
const isMissingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /marketplace_cases/.test(e.message ?? ''))

const key = (professionalId: string | undefined) => ['marketplace', 'cases', professionalId] as const

/** Casos de un perfil, para quien lo maneja. `available: false` si falta correr la migración. */
export function useManagedCases(professionalId: string | undefined) {
  return useQuery({
    queryKey: key(professionalId),
    enabled: Boolean(professionalId),
    staleTime: 30_000,
    queryFn: async (): Promise<{ cases: MarketplaceCase[]; available: boolean }> => {
      const { data, error } = await supabase.from('marketplace_cases').select(COLUMNS).eq('professional_id', professionalId!).order('orden').order('created_at')
      if (error) {
        if (isMissingTable(error)) return { cases: [], available: false }
        throw error
      }
      return { cases: (data ?? []) as MarketplaceCase[], available: true }
    },
  })
}

/** Casos que ve el público. Cualquier error (o la tabla sin crear) se trata como «no tiene». */
export function usePublicCases(professionalId: string | undefined) {
  return useQuery({
    queryKey: ['marketplace', 'public-cases', professionalId],
    enabled: Boolean(professionalId),
    staleTime: 60_000,
    queryFn: async (): Promise<MarketplaceCase[]> => {
      const { data, error } = await supabasePublic.from('marketplace_cases').select(COLUMNS).eq('professional_id', professionalId!).order('orden').order('created_at')
      return error ? [] : ((data ?? []) as MarketplaceCase[])
    },
  })
}

export type CaseInput = Pick<MarketplaceCase, 'tipo' | 'titulo' | 'texto' | 'media_url'>

export function useSaveCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, professionalId, input, orden }: { id: string | null; professionalId: string; input: CaseInput; orden?: number }) => {
      const res = id
        ? await supabase.from('marketplace_cases').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id)
        : await supabase.from('marketplace_cases').insert({ ...input, professional_id: professionalId, orden: orden ?? 0 })
      if (res.error) throw res.error
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: key(v.professionalId) }),
  })
}

export function useDeleteCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; professionalId: string }) => {
      const { error } = await supabase.from('marketplace_cases').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: key(v.professionalId) }),
  })
}

/** Link de video aceptado: https de YouTube, Instagram, TikTok, Vimeo o Google Drive. */
export function cleanVideoUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  u.protocol = 'https:'
  const host = u.hostname.replace(/^www\.|^m\./, '')
  const ok = ['youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com', 'vm.tiktok.com', 'vimeo.com', 'drive.google.com']
  return ok.some((h) => host === h || host.endsWith(`.${h}`)) ? u.toString().slice(0, 500) : null
}

/** «YouTube», «Instagram»… para el botón del video. */
export function videoSiteLabel(url: string): string {
  try {
    const host = new URL(url).hostname
    if (/youtu/.test(host)) return 'YouTube'
    if (/instagram/.test(host)) return 'Instagram'
    if (/tiktok/.test(host)) return 'TikTok'
    if (/vimeo/.test(host)) return 'Vimeo'
    if (/google/.test(host)) return 'Drive'
  } catch {
    /* nada */
  }
  return 'el sitio'
}

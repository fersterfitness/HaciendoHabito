import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import { normalizeQuestions, type FormAnswer, type FormQuestion } from '@/lib/marketplaceForm'
import type { MarketplaceRole } from '@/lib/marketplace'

/** Formulario propio de cada profesional (20261126120000_marketplace_formularios.sql). */

const isMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /marketplace_forms|request_form/.test(e.message ?? ''))

const key = (professionalId: string | undefined) => ['marketplace', 'form', professionalId] as const

/** Preguntas del profesional. `available: false` si falta correr la migración; `custom: false` si usa las de base. */
export function useProfessionalForm(professionalId: string | undefined) {
  return useQuery({
    queryKey: key(professionalId),
    enabled: Boolean(professionalId),
    staleTime: 30_000,
    queryFn: async (): Promise<{ questions: FormQuestion[]; available: boolean; custom: boolean }> => {
      const { data, error } = await supabase.from('marketplace_forms').select('preguntas').eq('professional_id', professionalId!).maybeSingle()
      if (error) {
        if (isMissing(error)) return { questions: normalizeQuestions(null), available: false, custom: false }
        throw error
      }
      return { questions: normalizeQuestions(data ? (data as { preguntas: unknown }).preguntas : null), available: true, custom: Boolean(data) }
    },
  })
}

export function useSaveProfessionalForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ professionalId, questions }: { professionalId: string; questions: FormQuestion[] }) => {
      const { error } = await supabase
        .from('marketplace_forms')
        .upsert({ professional_id: professionalId, preguntas: questions, updated_at: new Date().toISOString() }, { onConflict: 'professional_id' })
      if (error) throw error
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: key(v.professionalId) }),
  })
}

export interface PublicRequestForm {
  profesional_nombre: string
  profesional_rol: MarketplaceRole
  profesional_foto: string | null
  plan_titulo: string
  cliente_nombre: string
  questions: FormQuestion[]
  enviado_at: string | null
}

/** Lo que ve el cliente en `/f/:token`. `null` si el link no existe. */
export async function fetchRequestForm(token: string): Promise<PublicRequestForm | null> {
  const { data, error } = await supabasePublic.rpc('get_marketplace_request_form', { p_token: token })
  if (error) throw error
  if (!data) return null
  const d = data as Omit<PublicRequestForm, 'questions'> & { preguntas: unknown }
  return {
    profesional_nombre: d.profesional_nombre,
    profesional_rol: d.profesional_rol,
    profesional_foto: d.profesional_foto,
    plan_titulo: d.plan_titulo,
    cliente_nombre: d.cliente_nombre,
    questions: normalizeQuestions(d.preguntas),
    enviado_at: d.enviado_at,
  }
}

export async function submitRequestForm(token: string, answers: FormAnswer[], payDay: string): Promise<void> {
  const { error } = await supabasePublic.rpc('submit_marketplace_request_form', { p_token: token, p_respuestas: answers, p_dia_pago: payDay })
  if (error) throw error
}

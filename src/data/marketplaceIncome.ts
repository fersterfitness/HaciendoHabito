import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { INCOME_MIGRATION, type IncomeRow, type PaymentContact } from '@/lib/marketplaceIncome'

const friendly = (msg: string | undefined) =>
  /marketplace_income_summary|set_marketplace_commission|marketplace_payment_contacts|comision_pct/.test(msg ?? '') && /exist|schema cache|Could not find/i.test(msg ?? '')
    ? `Falta correr la migración ${INCOME_MIGRATION}`
    : (msg ?? 'Error')

/** Ingresos del mes («2026-11») por profesional. Solo el administrador. */
export function useMarketplaceIncome(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['marketplace', 'income', month],
    enabled,
    queryFn: async (): Promise<IncomeRow[]> => {
      const { data, error } = await supabase.rpc('marketplace_income_summary', { p_month: `${month}-01` })
      if (error) throw new Error(friendly(error.message))
      return ((data ?? []) as IncomeRow[]).map((r) => ({ ...r, comision_pct: Number(r.comision_pct), cobrado: Number(r.cobrado), para_admin: Number(r.para_admin) }))
    },
  })
}

export function useSetCommission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ professionalId, pct }: { professionalId: string; pct: number }) => {
      const { error } = await supabase.rpc('set_marketplace_commission', { p_professional_id: professionalId, p_pct: pct })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace'] }),
  })
}

/** Otros profesionales del envío con WhatsApp, para avisarles del pago. */
export async function fetchPaymentContacts(requestId: string): Promise<PaymentContact[]> {
  const { data, error } = await supabase.rpc('marketplace_payment_contacts', { p_request_id: requestId })
  if (error) throw new Error(friendly(error.message))
  return (data ?? []) as PaymentContact[]
}

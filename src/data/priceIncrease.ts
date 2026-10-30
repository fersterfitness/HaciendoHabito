/** Aumento periódico de precios: configuración, vista previa, aplicación e historial. */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/data/queryClient'
import { invalidateStudents } from '@/data/students'
import { useAuthStore } from '@/stores/authStore'
import {
  addMonthsYmd,
  DEFAULT_PRICE_INCREASE,
  increaseAmount,
  increasePriceLabel,
  type PriceIncreaseSettings,
} from '@/lib/finance/priceIncrease'
import type { Student, WebPlan } from '@/types/database'

export const PRICE_INCREASE_SQL_HINT =
  'Falta ejecutar la migración 20261030160000_oct5_calendario_volumen_finanzas.sql para programar aumentos.'

const LABEL_FIELDS = ['price_label', 'price_3m_label', 'price_6m_label', 'price_yearly_label'] as const
type LabelField = (typeof LABEL_FIELDS)[number]

export type WebPlanPrices = Pick<WebPlan, 'id' | 'slug' | 'title' | 'is_active'> & Partial<Record<LabelField, string | null>>

export type PriceChange =
  | { kind: 'student'; id: string; name: string; from: number; to: number }
  | { kind: 'web'; id: string; name: string; slug: string; from: string; to: string; patch: Partial<Record<LabelField, string>> }

export type PriceIncreaseLogRow = { id: string; applied_at: string; percent: number; details: PriceChange[] }

const keys = {
  settings: (uid: string | undefined) => ['finance', 'price-increase', uid ?? 'anon'] as const,
  webPlans: ['finance', 'price-increase', 'web-plans'] as const,
  log: (uid: string | undefined) => ['finance', 'price-increase-log', uid ?? 'anon'] as const,
}

async function fetchSettings(): Promise<{ settings: PriceIncreaseSettings; saved: boolean; ready: boolean }> {
  const { data, error } = await supabase.from('price_increase_settings').select('*').maybeSingle()
  if (error) return { settings: DEFAULT_PRICE_INCREASE, saved: false, ready: false }
  if (!data) return { settings: DEFAULT_PRICE_INCREASE, saved: false, ready: true }
  const row = data as Partial<PriceIncreaseSettings>
  return {
    settings: {
      ...DEFAULT_PRICE_INCREASE,
      ...row,
      percent: Number(row.percent ?? DEFAULT_PRICE_INCREASE.percent),
    },
    saved: true,
    ready: true,
  }
}

async function fetchWebPlans(): Promise<WebPlanPrices[]> {
  const { data, error } = await supabase
    .from('web_plans')
    .select('id, slug, title, is_active, price_label, price_3m_label, price_6m_label, price_yearly_label')
    .order('sort_order')
  if (error) return []
  return (data ?? []) as WebPlanPrices[]
}

async function fetchLog(): Promise<PriceIncreaseLogRow[]> {
  const { data, error } = await supabase.from('price_increase_log').select('id, applied_at, percent, details').order('applied_at', { ascending: false }).limit(20)
  if (error) return []
  return ((data ?? []) as PriceIncreaseLogRow[]).map((r) => ({ ...r, percent: Number(r.percent) }))
}

export function usePriceIncreaseSettings() {
  const { user } = useAuthStore()
  return useQuery({ queryKey: keys.settings(user?.id), queryFn: fetchSettings, enabled: Boolean(user) })
}

export function useWebPlanPrices(enabled = true) {
  return useQuery({ queryKey: keys.webPlans, queryFn: fetchWebPlans, enabled })
}

export function usePriceIncreaseLog(enabled = true) {
  const { user } = useAuthStore()
  return useQuery({ queryKey: keys.log(user?.id), queryFn: fetchLog, enabled: Boolean(user) && enabled })
}

function refresh() {
  return queryClient.invalidateQueries({ queryKey: ['finance', 'price-increase'] })
}

export async function savePriceIncreaseSettings(next: PriceIncreaseSettings): Promise<string | null> {
  const { error } = await supabase
    .from('price_increase_settings')
    .upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' })
  if (error) return /does not exist|schema cache/i.test(error.message) ? PRICE_INCREASE_SQL_HINT : error.message
  void refresh()
  return null
}

/** Qué cambiaría con el aumento: cuotas de alumnos activos y precios de los planes web elegidos. */
export function previewPriceIncrease(
  settings: PriceIncreaseSettings,
  students: Pick<Student, 'id' | 'full_name' | 'monthly_fee_amount'>[],
  webPlans: WebPlanPrices[],
): PriceChange[] {
  const out: PriceChange[] = []
  if (settings.apply_students) {
    for (const s of students) {
      const fee = Number(s.monthly_fee_amount || 0)
      if (fee > 0) out.push({ kind: 'student', id: s.id, name: s.full_name, from: fee, to: increaseAmount(fee, settings.percent, settings.round_to) })
    }
  }
  if (settings.apply_web_plans) {
    for (const p of webPlans) {
      if (!p.is_active) continue
      if (settings.web_plan_slugs && !settings.web_plan_slugs.includes(p.slug)) continue
      const patch: Partial<Record<LabelField, string>> = {}
      for (const f of LABEL_FIELDS) {
        const next = increasePriceLabel(p[f], settings.percent, settings.round_to)
        if (next) patch[f] = next
      }
      if (patch.price_label) out.push({ kind: 'web', id: p.id, name: p.title, slug: p.slug, from: p.price_label ?? '', to: patch.price_label, patch })
    }
  }
  return out
}

/** Aplica el aumento, lo deja en el historial y programa el siguiente. */
export async function applyPriceIncrease(settings: PriceIncreaseSettings, changes: PriceChange[]): Promise<string | null> {
  const failed: string[] = []
  for (const c of changes) {
    const { error } =
      c.kind === 'student'
        ? await supabase.from('students').update({ monthly_fee_amount: c.to }).eq('id', c.id)
        : await supabase.from('web_plans').update(c.patch).eq('id', c.id)
    if (error) failed.push(`${c.name}: ${error.message}`)
  }
  const applied = changes.filter((c) => !failed.some((f) => f.startsWith(`${c.name}:`)))
  const { error: logErr } = await supabase.from('price_increase_log').insert({ percent: settings.percent, details: applied })
  if (logErr) failed.push(`Historial: ${logErr.message}`)

  const today = new Date()
  const base = settings.next_date ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const nextErr = await savePriceIncreaseSettings({ ...settings, next_date: addMonthsYmd(base, settings.every_months), notice_copied_for: null })
  if (nextErr) failed.push(nextErr)

  void invalidateStudents()
  void queryClient.invalidateQueries({ queryKey: ['finance'] })
  return failed.length ? `Algunos cambios fallaron — ${failed.join(' · ')}` : null
}

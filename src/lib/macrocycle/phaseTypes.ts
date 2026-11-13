/** Fases del macrociclo: lista editable por el entrenador (tabla `macrocycle_phase_types`). */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/data/queryClient'
import { useAuthStore } from '@/stores/authStore'

export type PhaseType = { id: string; label: string; color: string }

/** Las de fábrica (pedido del entrenador): se usan mientras no haya armado su propia lista. */
export const DEFAULT_PHASE_TYPES: PhaseType[] = [
  { id: 'adaptacion', label: 'Adaptación', color: '#38bdf8' },
  { id: 'acumulacion', label: 'Acumulación', color: '#a78bfa' },
  { id: 'intensificacion', label: 'Intensificación', color: '#fb923c' },
  { id: 'peak', label: 'Peak', color: '#f43f5e' },
  { id: 'descarga', label: 'Descarga', color: '#34d399' },
]

/** Fases de la lista anterior: los bloques que ya las tienen siguen mostrando nombre y color. */
const LEGACY_PHASE_TYPES: PhaseType[] = [
  { id: 'desarrollo', label: 'Desarrollo', color: '#a78bfa' },
  { id: 'realizacion', label: 'Realización', color: '#f43f5e' },
  { id: 'transicion', label: 'Transición', color: '#94a3b8' },
]

let current: PhaseType[] = DEFAULT_PHASE_TYPES

/** Lista vigente (la última cargada). La usan `blockColor` / `blockTypeLabel`. */
export function currentPhaseTypes(): PhaseType[] {
  return current
}

export function findPhaseType(id: string | null | undefined): PhaseType | undefined {
  if (!id) return undefined
  return current.find((t) => t.id === id) ?? DEFAULT_PHASE_TYPES.find((t) => t.id === id) ?? LEGACY_PHASE_TYPES.find((t) => t.id === id)
}

export const PHASES_SQL_HINT =
  'Para editar las fases falta correr en Supabase la migración 20261101120000_oct6_correcciones.sql.'

type Row = { key: string; label: string; color: string; sort_order: number }

const phaseKeys = { list: (userId: string | undefined) => ['macrocycle', 'phase-types', userId ?? 'anon'] as const }

async function fetchPhaseTypes(): Promise<{ list: PhaseType[]; custom: boolean }> {
  const { data, error } = await supabase.from('macrocycle_phase_types').select('key, label, color, sort_order').order('sort_order')
  if (error || !data?.length) {
    current = DEFAULT_PHASE_TYPES
    return { list: DEFAULT_PHASE_TYPES, custom: false }
  }
  current = (data as Row[]).map((r) => ({ id: r.key, label: r.label, color: r.color }))
  return { list: current, custom: true }
}

/** Fases del entrenador (o las de fábrica). */
export function usePhaseTypes(): PhaseType[] {
  const userId = useAuthStore((s) => s.user?.id)
  const q = useQuery({ queryKey: phaseKeys.list(userId), queryFn: fetchPhaseTypes, enabled: !!userId, staleTime: 5 * 60_000 })
  if (q.data) current = q.data.list
  return q.data?.list ?? current
}

/** Clave estable a partir del nombre: «Peak 2» → `peak-2`. */
export function phaseKeyFromLabel(label: string, taken: string[]): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'fase'
  let key = base
  for (let n = 2; taken.includes(key); n++) key = `${base}-${n}`
  return key
}

/** Guarda la lista completa (reemplaza la anterior). Los bloques ya marcados conservan su fase. */
export async function savePhaseTypes(list: PhaseType[]): Promise<string | null> {
  const { error: delErr } = await supabase.from('macrocycle_phase_types').delete().not('key', 'is', null)
  if (delErr) return /macrocycle_phase_types|schema cache/i.test(delErr.message) ? PHASES_SQL_HINT : delErr.message
  if (list.length) {
    const { error } = await supabase
      .from('macrocycle_phase_types')
      .insert(list.map((t, i) => ({ key: t.id, label: t.label.trim(), color: t.color, sort_order: i })))
    if (error) return error.message
  }
  current = list.length ? list : DEFAULT_PHASE_TYPES
  await queryClient.invalidateQueries({ queryKey: ['macrocycle', 'phase-types'] })
  return null
}

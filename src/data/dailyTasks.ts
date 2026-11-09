/**
 * Misiones del «Para hoy» del entrenador (`trainer_daily_tasks`): cada tarea del Inicio se guarda
 * el día que aparece y, al tildarla, con la fecha en que se hizo. No reaparece al recargar, se puede
 * deshacer y, si no se tildó, al día siguiente figura como vencida.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type TaskCategory = 'feedback' | 'rutinas' | 'avisos' | 'cobros'

/** Lo que el Inicio calcula hoy como tarea (lo que se guarda si es la primera vez que aparece). */
export type MissionDef = {
  key: string
  category: TaskCategory
  title: string
  detail?: string | null
  href?: string | null
}

export type DailyTaskRow = {
  task_key: string
  category: TaskCategory
  title: string
  detail: string | null
  href: string | null
  first_seen_on: string
  completed_at: string | null
}

/** Las pendientes que dejaron de calcularse siguen saliendo como vencidas esta cantidad de días. */
export const ORPHAN_DAYS = 7
const LOOKBACK_DAYS = 90

export const ymdLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function addDays(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

const keyOf = (ownerId: string | undefined) => ['daily-tasks', ownerId] as const

/** Estado de una misión para hoy. */
export type MissionState = { done: boolean; overdue: boolean; firstSeen: string }

export function useDailyMissions(ownerId: string | undefined, defs: MissionDef[], today: Date) {
  const qc = useQueryClient()
  const todayYmd = ymdLocal(today)
  const startOfToday = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [today])

  const q = useQuery({
    queryKey: keyOf(ownerId),
    enabled: Boolean(ownerId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_daily_tasks')
        .select('task_key, category, title, detail, href, first_seen_on, completed_at')
        .eq('owner_id', ownerId!)
        .gte('first_seen_on', ymdLocal(addDays(today, -LOOKBACK_DAYS)))
        .limit(2000)
      if (error) throw error
      return (data ?? []) as DailyTaskRow[]
    },
    retry: false,
  })
  const rows = useMemo(() => q.data ?? [], [q.data])
  const byKey = useMemo(() => new Map(rows.map((r) => [r.task_key, r])), [rows])
  /** Sin la tabla (SQL sin correr) se tilda igual, pero solo hasta recargar. */
  const persistent = q.errorUpdateCount === 0

  // Primera vez que aparece una tarea: se guarda con el día de hoy (para saber cuándo vence).
  const pendingInsert = useRef(new Set<string>())
  useEffect(() => {
    if (!ownerId || !q.isSuccess) return
    const fresh = defs.filter((d) => !byKey.has(d.key) && !pendingInsert.current.has(d.key))
    if (!fresh.length) return
    fresh.forEach((d) => pendingInsert.current.add(d.key))
    void supabase
      .from('trainer_daily_tasks')
      .upsert(
        fresh.map((d) => ({
          owner_id: ownerId,
          task_key: d.key,
          category: d.category,
          title: d.title.slice(0, 300),
          detail: d.detail?.slice(0, 600) ?? null,
          href: d.href ?? null,
          first_seen_on: todayYmd,
        })),
        { onConflict: 'owner_id,task_key', ignoreDuplicates: true },
      )
      .then(({ error }) => {
        if (error) console.warn('No se pudieron guardar las tareas de hoy', error.message)
        void qc.invalidateQueries({ queryKey: keyOf(ownerId) })
      })
  }, [defs, byKey, ownerId, q.isSuccess, todayYmd, qc])

  const setDone = useMutation({
    mutationFn: async ({ def, done }: { def: MissionDef | DailyTaskRow; done: boolean }) => {
      if (!ownerId || !persistent) return
      const key = 'key' in def ? def.key : def.task_key
      const { error } = await supabase.from('trainer_daily_tasks').upsert(
        {
          owner_id: ownerId,
          task_key: key,
          category: def.category,
          title: def.title.slice(0, 300),
          detail: def.detail?.slice(0, 600) ?? null,
          href: def.href ?? null,
          first_seen_on: byKey.get(key)?.first_seen_on ?? todayYmd,
          completed_at: done ? new Date().toISOString() : null,
        },
        { onConflict: 'owner_id,task_key' },
      )
      if (error) throw error
    },
    onMutate: async ({ def, done }) => {
      const key = 'key' in def ? def.key : def.task_key
      await qc.cancelQueries({ queryKey: keyOf(ownerId) })
      const prev = qc.getQueryData<DailyTaskRow[]>(keyOf(ownerId))
      const base: DailyTaskRow = byKey.get(key) ?? {
        task_key: key,
        category: def.category,
        title: def.title,
        detail: def.detail ?? null,
        href: def.href ?? null,
        first_seen_on: todayYmd,
        completed_at: null,
      }
      const next = { ...base, completed_at: done ? new Date().toISOString() : null }
      qc.setQueryData<DailyTaskRow[]>(keyOf(ownerId), (old) => [...(old ?? []).filter((r) => r.task_key !== key), next])
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keyOf(ownerId), ctx.prev)
    },
    onSettled: () => {
      if (persistent) void qc.invalidateQueries({ queryKey: keyOf(ownerId) })
    },
  })

  const isDoneRow = useCallback((r: DailyTaskRow | undefined) => Boolean(r?.completed_at), [])
  const doneToday = useCallback(
    (r: DailyTaskRow) => Boolean(r.completed_at) && new Date(r.completed_at!) >= startOfToday,
    [startOfToday],
  )

  const stateOf = useCallback(
    (key: string): MissionState => {
      const r = byKey.get(key)
      const firstSeen = r?.first_seen_on ?? todayYmd
      return { done: isDoneRow(r), overdue: !isDoneRow(r) && firstSeen < todayYmd, firstSeen }
    },
    [byKey, isDoneRow, todayYmd],
  )

  const defKeys = useMemo(() => new Set(defs.map((d) => d.key)), [defs])
  /** Pendientes de días anteriores que ya no se calculan (ej. el aviso del viernes): siguen como vencidas. */
  const orphans = useMemo(() => {
    const from = ymdLocal(addDays(today, -ORPHAN_DAYS))
    return rows
      .filter((r) => !r.completed_at && !defKeys.has(r.task_key) && r.first_seen_on < todayYmd && r.first_seen_on >= from)
      .sort((a, b) => a.first_seen_on.localeCompare(b.first_seen_on))
  }, [rows, defKeys, today, todayYmd])
  const completedToday = useMemo(
    () => rows.filter(doneToday).sort((a, b) => a.completed_at!.localeCompare(b.completed_at!)),
    [rows, doneToday],
  )

  return {
    ready: !ownerId || !q.isPending,
    persistent,
    stateOf,
    orphans,
    completedToday,
    complete: (def: MissionDef | DailyTaskRow) => setDone.mutate({ def, done: true }),
    undo: (def: MissionDef | DailyTaskRow) => setDone.mutate({ def, done: false }),
  }
}

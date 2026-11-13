import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useActiveStudents, useIncomes } from '@/data/finance'
import { buildPaymentBoard } from '@/lib/finance/studentPayments'
import { NUTRITION_CONTROL_OVERDUE_DAYS } from '@/lib/dashboard/nutritionistOps'
import { ATTENTION_GROUPS, buildAttention, type AttentionKind } from '@/lib/nutrition/patientAttention'
import type { Income } from '@/types/database'
import type { NutritionFollowupRow } from './NutritionPatientDirectory'

/** Color del casillero de cada motivo. */
const TILE: Record<AttentionKind, string> = {
  hoy: 'bg-pastel-mint text-pastel-mint-ink',
  sintomas: 'bg-pastel-rose text-pastel-rose-ink',
  pago: 'bg-pastel-butter text-pastel-butter-ink',
  control: 'bg-pastel-lavender text-pastel-lavender-ink',
}

const COLLAPSE_KEY = 'hh-attention-collapsed'
const PER_GROUP = 4

/**
 * v2: arriba de la lista, a quién hay que mirar hoy y por qué. Cada nombre abre la carpeta.
 * Si no hay nadie, no se muestra.
 */
export function NutritionAttentionPanel({
  ownerId,
  rows,
  onOpen,
}: {
  ownerId: string
  rows: NutritionFollowupRow[]
  onOpen: (studentId: string) => void
}) {
  const [appointments, setAppointments] = useState<{ student_id: string; starts_at: string }[]>([])
  const [checkins, setCheckins] = useState<
    { student_id: string; logged_at: string; digestive_discomfort_0_10: number | null; adherence_1_5: number | null }[]
  >([])
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [expanded, setExpanded] = useState<Partial<Record<AttentionKind, boolean>>>({})

  useEffect(() => {
    let alive = true
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
    void Promise.all([
      supabase
        .from('appointments')
        .select('student_id, starts_at')
        .eq('owner_id', ownerId)
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', start.toISOString())
        .order('starts_at', { ascending: true })
        .limit(500),
      supabase
        .from('nutrition_symptom_checkins')
        .select('student_id, logged_at, digestive_discomfort_0_10, adherence_1_5')
        .eq('owner_id', ownerId)
        .gte('logged_at', since)
        .limit(2000),
    ]).then(([a, c]) => {
      if (!alive) return
      setAppointments((a.data as typeof appointments | null) ?? [])
      setCheckins((c.data as typeof checkins | null) ?? [])
    })
    return () => {
      alive = false
    }
  }, [ownerId])

  const studentsQuery = useActiveStudents()
  const incomesQuery = useIncomes()
  const overduePayments = useMemo(() => {
    const students = studentsQuery.data ?? []
    const incomes = (incomesQuery.data ?? []).filter((i: Income) => (i.scope ?? 'business') === 'business' && i.student_id)
    if (!students.length) return new Set<string>()
    const today = new Date()
    const month = new Date(today.getFullYear(), today.getMonth(), 1)
    return new Set(buildPaymentBoard({ students, incomes, month, today }).filter((r) => r.state === 'vencido').map((r) => r.studentId))
  }, [studentsQuery.data, incomesQuery.data])

  const items = useMemo(
    () =>
      buildAttention({
        patients: rows
          .filter((r) => !r.status || r.status === 'activo')
          .map((r) => ({ id: r.id, full_name: r.full_name, lastControlDate: r.lastControl?.date ?? null })),
        appointments,
        checkins,
        overduePayments,
        overdueControlDays: NUTRITION_CONTROL_OVERDUE_DAYS,
      }),
    [rows, appointments, checkins, overduePayments],
  )

  if (!items.length) return null
  const groups = ATTENTION_GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.kind === g.kind) })).filter((g) => g.items.length)

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      /* sin almacenamiento: queda solo en esta visita */
    }
  }

  return (
    <section className="rounded-2xl border border-surface-border bg-surface-card shadow-sm dark:bg-surface-panel" aria-label="Necesitan atención">
      <button type="button" onClick={toggle} aria-expanded={!collapsed} className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5">
        <span className="text-[14px] font-semibold text-ink-primary">Necesitan atención</span>
        <span className="rounded-full bg-surface-elevated px-2 py-px text-[12px] font-medium tabular-nums text-ink-secondary">{items.length}</span>
        {collapsed ? (
          <span className="hidden min-w-0 truncate text-[12.5px] text-ink-muted sm:inline">
            {groups.map((g) => `${g.items.length} ${g.title.toLowerCase()}`).join(' · ')}
          </span>
        ) : null}
        <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-ink-muted transition-transform', !collapsed && 'rotate-180')} aria-hidden />
      </button>
      {collapsed ? null : (
        <div className="grid gap-x-4 gap-y-5 border-t border-surface-border/70 px-4 pb-4 pt-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
          {groups.map((g) => {
            const open = expanded[g.kind]
            const shown = open ? g.items : g.items.slice(0, PER_GROUP)
            return (
              <div key={g.kind} className="min-w-0">
                <p className={cn('hh-pastel mb-2 flex items-baseline gap-2 rounded-xl px-3.5 py-2.5', TILE[g.kind])}>
                  <span className="text-2xl font-semibold leading-none tabular-nums tracking-tight">{g.items.length}</span>
                  <span className="min-w-0 text-xs font-medium leading-tight">{g.title}</span>
                </p>
                <ul>
                  {shown.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(i.id)}
                        className="flex w-full min-w-0 flex-col rounded-lg px-3.5 py-1.5 text-left transition-colors hover:bg-surface-elevated"
                      >
                        <span className="truncate text-[13.5px] font-medium text-ink-primary">{i.full_name}</span>
                        <span className="truncate text-[12px] text-ink-muted">{[i.detail, ...i.extra].join(' · ')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {g.items.length > PER_GROUP ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [g.kind]: !open }))}
                    className="mt-1 text-[12px] font-medium text-ink-muted hover:text-ink-primary"
                  >
                    {open ? 'Ver menos' : `Ver ${g.items.length - PER_GROUP} más`}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

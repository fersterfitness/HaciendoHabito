import { useEffect, useState, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarClock, ClipboardList, FileQuestion, Ruler, ChevronRight } from 'lucide-react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { loadNutritionistOps, type NutritionistOps, type NutritionOpsPatient } from '@/lib/dashboard/nutritionistOps'
import { cn } from '@/lib/utils'

const MAX_ROWS = 5

function Block({
  icon,
  title,
  count,
  tone,
  empty,
  children,
  onSeeAll,
}: {
  icon: ReactNode
  title: string
  count: number
  tone: 'brand' | 'warning' | 'danger' | 'info'
  empty: string
  children: ReactNode
  onSeeAll?: () => void
}) {
  const toneClass = {
    brand: 'hh-alert-icon',
    warning: 'hh-alert-icon hh-alert-warning',
    danger: 'hh-alert-icon hh-alert-danger',
    info: 'hh-alert-icon hh-alert-info',
  }[tone]
  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cn(toneClass, 'h-8 w-8 shrink-0')} aria-hidden>
          {icon}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-ink-primary">{title}</h3>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink-primary/[0.08] px-1.5 text-3xs font-bold tabular-nums text-ink-primary">
          {count}
        </span>
      </div>
      {count === 0 ? <p className="py-2 text-xs text-ink-muted">{empty}</p> : <ul className="space-y-0.5">{children}</ul>}
      {onSeeAll && count > MAX_ROWS ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-2 self-start text-2xs font-semibold text-brand-primary hover:underline"
        >
          Ver los {count}
        </button>
      ) : null}
    </section>
  )
}

function PatientRow({ p, onOpen }: { p: NutritionOpsPatient; onOpen: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(p.id)}
        className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-elevated/60"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-ink-primary">{p.full_name}</span>
          <span className="block truncate text-3xs text-ink-muted">{p.detail}</span>
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </li>
  )
}

/** Inicio del nutricionista: lo que hay que hacer esta semana, por paciente. */
export function NutritionistOpsPanel({ ownerId }: { ownerId: string }) {
  const navigate = useAppNavigate()
  const [ops, setOps] = useState<NutritionistOps | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadNutritionistOps(ownerId)
      .then((o) => {
        if (!cancelled) setOps(o)
      })
      .catch(() => {
        if (!cancelled) setOps({ upcoming: [], overdueControls: [], withoutPlan: [], pendingAnamnesis: [] })
      })
    return () => {
      cancelled = true
    }
  }, [ownerId])

  if (!ops) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="hh-shimmer h-40 rounded-2xl" />
        ))}
      </div>
    )
  }

  const open = (id: string) => navigate(`/nutrition/${id}`)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Block
        icon={<CalendarClock className="h-4 w-4" />}
        title="Consultas · 7 días"
        count={ops.upcoming.length}
        tone="brand"
        empty="No hay consultas agendadas esta semana."
        onSeeAll={() => navigate('/appointments')}
      >
        {ops.upcoming.slice(0, MAX_ROWS).map((a) => (
          <PatientRow
            key={a.id}
            p={{
              id: a.student_id,
              full_name: a.full_name,
              detail: format(parseISO(a.starts_at), "EEE d MMM · HH:mm", { locale: es }),
            }}
            onOpen={open}
          />
        ))}
      </Block>
      <Block
        icon={<Ruler className="h-4 w-4" />}
        title="Controles atrasados"
        count={ops.overdueControls.length}
        tone="warning"
        empty="Todos tienen un control reciente."
        onSeeAll={() => navigate('/nutrition/anthropometry')}
      >
        {ops.overdueControls.slice(0, MAX_ROWS).map((p) => (
          <PatientRow key={p.id} p={p} onOpen={open} />
        ))}
      </Block>
      <Block
        icon={<ClipboardList className="h-4 w-4" />}
        title="Sin plan activo"
        count={ops.withoutPlan.length}
        tone="danger"
        empty="Todos los pacientes activos tienen plan."
        onSeeAll={() => navigate('/nutrition')}
      >
        {ops.withoutPlan.slice(0, MAX_ROWS).map((p) => (
          <PatientRow key={p.id} p={p} onOpen={open} />
        ))}
      </Block>
      <Block
        icon={<FileQuestion className="h-4 w-4" />}
        title="Anamnesis pendientes"
        count={ops.pendingAnamnesis.length}
        tone="info"
        empty="No hay anamnesis enviadas sin completar."
        onSeeAll={() => navigate('/nutrition')}
      >
        {ops.pendingAnamnesis.slice(0, MAX_ROWS).map((p) => (
          <PatientRow key={p.id} p={p} onOpen={open} />
        ))}
      </Block>
    </div>
  )
}

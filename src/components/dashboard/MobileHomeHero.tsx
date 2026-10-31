import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronDown, ChevronRight, MessageSquareWarning, TimerReset, Wallet, type LucideIcon } from 'lucide-react'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { cn, formatCurrency } from '@/lib/utils'

function greeting(now: Date) {
  const h = now.getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 13) return 'Buen día'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

type Tile = {
  key: string
  label: string
  value: string
  hint: string
  to: string
  icon: LucideIcon
  /** Hay algo para atender: se resalta. */
  alert: boolean
}

/**
 * Cabecera del Inicio en el celu: saludo y un resumen de lo de hoy en cuatro mosaicos que llevan
 * directo a cada sección. En escritorio no se muestra (el tablero ya tiene todo a la vista).
 */
export function MobileHomeHero({
  firstName,
  todayAppointments,
  missingFeedback,
  expiringSoon,
  pendingIncome,
  showTraining,
  showFinances,
}: {
  firstName: string
  todayAppointments: number
  missingFeedback: number
  expiringSoon: number
  pendingIncome: number
  showTraining: boolean
  showFinances: boolean
}) {
  const now = new Date()
  const dateLabel = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  const tiles: Tile[] = [
    {
      key: 'turnos',
      label: 'Turnos hoy',
      value: String(todayAppointments),
      hint: todayAppointments ? 'Ver agenda' : 'Agenda libre',
      to: '/appointments',
      icon: CalendarClock,
      alert: false,
    },
    ...(showTraining
      ? [
          {
            key: 'feedback',
            label: 'Sin feedback',
            value: String(missingFeedback),
            hint: missingFeedback ? 'Recordales' : 'Todos al día',
            to: '/feedback?tab=checkins',
            icon: MessageSquareWarning,
            alert: missingFeedback > 0,
          },
          {
            key: 'vencen',
            label: 'Vencen pronto',
            value: String(expiringSoon),
            hint: 'Próximos 7 días',
            to: '/routines',
            icon: TimerReset,
            alert: expiringSoon > 0,
          },
        ]
      : []),
    ...(showFinances
      ? [
          {
            key: 'cobrar',
            label: 'Por cobrar',
            value: formatCurrency(pendingIncome),
            hint: pendingIncome ? 'Ir a Finanzas' : 'Nada pendiente',
            to: '/finances',
            icon: Wallet,
            alert: pendingIncome > 0,
          },
        ]
      : []),
  ]

  return (
    <section className="lg:hidden" aria-label="Resumen de hoy">
      <p className="text-2xs font-medium capitalize text-ink-muted">{dateLabel}</p>
      <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink-primary">
        {greeting(now)}
        {firstName ? `, ${firstName}` : ''}
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <Link
              key={t.key}
              to={t.to}
              className={cn(
                'group relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-3.5 transition-colors motion-safe:active:scale-[0.98]',
                appFocusRingClassName,
                t.alert
                  ? 'border-brand-primary/30 bg-brand-primary/[0.06]'
                  : 'border-surface-border/80 bg-surface-card shadow-card',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl',
                    t.alert ? 'bg-brand-primary text-white' : 'bg-surface-elevated text-ink-secondary',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold tabular-nums tracking-tight text-ink-primary">{t.value}</p>
                <p className="text-xs font-medium text-ink-secondary">{t.label}</p>
                <p className="text-3xs text-ink-muted">{t.hint}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Agrupa secciones de consulta (gráficos, rankings) para plegarlas en el celu.
 * En escritorio el envoltorio desaparece (`lg:contents`) y todo queda igual que antes.
 */
export function MobileFold({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-6 lg:contents">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-surface-border/80 bg-surface-card px-4 py-3.5 text-left shadow-card lg:hidden',
          appFocusRingClassName,
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-primary">{title}</span>
          {subtitle ? <span className="block text-2xs text-ink-muted">{subtitle}</span> : null}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-ink-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div className={cn(open ? 'flex' : 'hidden', 'flex-col gap-6 lg:contents')}>{children}</div>
    </div>
  )
}

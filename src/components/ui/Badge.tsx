import { cn } from '@/lib/utils'

type BadgeStatus =
  | 'activa'
  | 'por_vencer'
  | 'vencida'
  | 'completada'
  | 'pausada'
  | 'cancelada'
  | 'pendiente'
  | 'en_proceso'
  | 'generado'
  | 'enviado'
  | 'error'
  | 'recibida'
  | 'en_revision'
  | 'devuelta'
  | 'cerrada'
  | 'activo'
  | 'inactivo'
  | 'cobrado'
  | 'inicial'
  | 'intermedio'
  | 'avanzado'
  | 'plan-entrenamiento'
  | 'plan-nutricion'
  | 'plan-full'

const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  /** Rutinas: verde = en curso, ámbar = alerta, rojo = vencida, gris = pausada/cancelada */
  activa: {
    label: 'Activa',
    className: 'bg-status-generated/12 text-status-generated ring-1 ring-inset ring-status-generated/30',
  },
  activo: {
    label: 'Activo',
    className: 'bg-status-generated/12 text-status-generated ring-1 ring-inset ring-status-generated/30',
  },
  por_vencer: {
    label: 'Por vencer',
    className: 'bg-status-expiring/12 text-status-expiring ring-1 ring-inset ring-status-expiring/30',
  },
  vencida: {
    label: 'Vencida',
    className: 'bg-status-expired/12 text-status-expired ring-1 ring-inset ring-status-expired/30',
  },
  completada: {
    label: 'Completada',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/30',
  },
  pausada: {
    label: 'Pausada',
    className: 'bg-status-paused/12 text-status-paused ring-1 ring-inset ring-status-paused/30',
  },
  cancelada: {
    label: 'Cancelada',
    className: 'bg-surface-border/40 text-ink-muted ring-1 ring-inset ring-surface-border/30',
  },
  inactivo: {
    label: 'Inactivo',
    className: 'bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/25',
  },
  pendiente: {
    label: 'Pendiente',
    className: 'bg-status-pending/12 text-status-pending ring-1 ring-inset ring-status-pending/30',
  },
  en_proceso: {
    label: 'Procesando',
    className: 'bg-status-sent/12 text-status-sent ring-1 ring-inset ring-status-sent/30',
  },
  generado: {
    label: 'PDF listo',
    className: 'bg-status-generated/12 text-status-generated ring-1 ring-inset ring-status-generated/30',
  },
  enviado: {
    label: 'Enviado',
    className: 'bg-status-generated/12 text-status-generated ring-1 ring-inset ring-status-generated/30',
  },
  error: {
    label: 'Error',
    className: 'bg-status-error/12 text-status-error ring-1 ring-inset ring-status-error/30',
  },
  recibida: {
    label: 'Recibida',
    className: 'bg-status-pending/12 text-status-pending ring-1 ring-inset ring-status-pending/30',
  },
  en_revision: {
    label: 'En revisión',
    className: 'bg-status-expiring/12 text-status-expiring ring-1 ring-inset ring-status-expiring/30',
  },
  devuelta: {
    label: 'Devuelta',
    className: 'bg-status-generated/12 text-status-generated ring-1 ring-inset ring-status-generated/30',
  },
  cerrada: {
    label: 'Cerrada',
    className: 'bg-surface-border/30 text-ink-muted ring-1 ring-inset ring-surface-border/30',
  },
  cobrado: {
    label: 'Cobrado',
    className: 'bg-status-generated/12 text-status-generated ring-1 ring-inset ring-status-generated/30',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-surface-border/30 text-ink-muted ring-1 ring-inset ring-surface-border/30',
  },
  pausado: {
    label: 'Pausado',
    className: 'bg-status-expiring/12 text-status-expiring ring-1 ring-inset ring-status-expiring/30',
  },
  baja: {
    label: 'Baja',
    className: 'bg-status-expired/12 text-status-expired ring-1 ring-inset ring-status-expired/30',
  },
  inicial: {
    label: 'Inicial',
    className: 'bg-surface-elevated text-ink-secondary ring-1 ring-inset ring-surface-border',
  },
  intermedio: {
    label: 'Intermedio',
    className: 'bg-surface-elevated/90 text-ink-primary ring-1 ring-inset ring-surface-border',
  },
  avanzado: {
    label: 'Avanzado',
    className: 'bg-surface-elevated text-ink-secondary ring-1 ring-inset ring-surface-border',
  },
  'plan-entrenamiento': {
    label: 'Plan Entrenamiento',
    className: 'bg-surface-elevated text-ink-secondary ring-1 ring-inset ring-surface-border',
  },
  'plan-nutricion': {
    label: 'Plan Nutrición',
    className: 'bg-surface-elevated text-ink-secondary ring-1 ring-inset ring-surface-border',
  },
  'plan-full': {
    label: 'Plan Full',
    className: 'bg-surface-elevated text-ink-secondary ring-1 ring-inset ring-surface-border',
  },
}

interface BadgeProps {
  status: BadgeStatus | string
  className?: string
  size?: 'sm' | 'md'
}

export function Badge({ status, className, size = 'sm' }: BadgeProps) {
  const config = BADGE_CONFIG[status] ?? {
    label: status,
    className: 'bg-surface-elevated text-ink-secondary ring-1 ring-inset ring-surface-border',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        config.className,
        className
      )}
    >
      {/* Punto de estado: la identidad no depende solo del color de fondo. */}
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />
      {config.label}
    </span>
  )
}

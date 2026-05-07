import { cn } from '@/lib/utils'

type BadgeStatus =
  | 'activa'
  | 'por_vencer'
  | 'vencida'
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
  activa: {
    label: 'Activa',
    className: 'bg-brand-primary/20 text-brand-primary border border-brand-primary/45',
  },
  activo: {
    label: 'Activo',
    className: 'bg-status-generated/20 text-status-generated border border-status-generated/45',
  },
  por_vencer: {
    label: 'Por vencer',
    className: 'bg-status-expiring/20 text-status-expiring border border-status-expiring/45',
  },
  vencida: {
    label: 'Vencida',
    className: 'bg-status-expired/24 text-status-expired border border-status-expired/55',
  },
  pausada: {
    label: 'Pausada',
    className: 'bg-surface-border/50 text-ink-muted border border-surface-border',
  },
  cancelada: {
    label: 'Cancelada',
    className: 'bg-surface-border/30 text-ink-muted border border-surface-border/50',
  },
  inactivo: {
    label: 'Inactivo',
    className: 'bg-slate-500/10 text-slate-400 border border-slate-500/25',
  },
  pendiente: {
    label: 'Pendiente',
    className: 'bg-status-pending/20 text-status-pending border border-status-pending/45',
  },
  en_proceso: {
    label: 'Procesando',
    className: 'bg-status-sent/20 text-status-sent border border-status-sent/45',
  },
  generado: {
    label: 'PDF listo',
    className: 'bg-status-generated/20 text-status-generated border border-status-generated/45',
  },
  enviado: {
    label: 'Enviado',
    className: 'bg-status-generated/25 text-status-generated border border-status-generated/55',
  },
  error: {
    label: 'Error',
    className: 'bg-status-error/24 text-status-error border border-status-error/55',
  },
  recibida: {
    label: 'Recibida',
    className: 'bg-status-pending/20 text-status-pending border border-status-pending/45',
  },
  en_revision: {
    label: 'En revisión',
    className: 'bg-status-expiring/20 text-status-expiring border border-status-expiring/45',
  },
  devuelta: {
    label: 'Devuelta',
    className: 'bg-status-generated/20 text-status-generated border border-status-generated/45',
  },
  cerrada: {
    label: 'Cerrada',
    className: 'bg-surface-border/30 text-ink-muted border border-surface-border/50',
  },
  cobrado: {
    label: 'Cobrado',
    className: 'bg-status-generated/20 text-status-generated border border-status-generated/45',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-surface-border/30 text-ink-muted border border-surface-border/50',
  },
  pausado: {
    label: 'Pausado',
    className: 'bg-status-expiring/20 text-status-expiring border border-status-expiring/45',
  },
  baja: {
    label: 'Baja',
    className: 'bg-status-expired/24 text-status-expired border border-status-expired/55',
  },
  inicial: {
    label: 'Inicial',
    className: 'bg-surface-elevated text-ink-secondary border border-surface-border',
  },
  intermedio: {
    label: 'Intermedio',
    className: 'bg-surface-elevated/90 text-ink-primary border border-surface-border',
  },
  avanzado: {
    label: 'Avanzado',
    className: 'bg-surface-elevated text-ink-secondary border border-surface-border',
  },
  'plan-entrenamiento': {
    label: 'Plan Entrenamiento',
    className: 'bg-surface-elevated text-ink-secondary border border-surface-border',
  },
  'plan-nutricion': {
    label: 'Plan Nutrición',
    className: 'bg-surface-elevated text-ink-secondary border border-surface-border',
  },
  'plan-full': {
    label: 'Plan Full',
    className: 'bg-surface-elevated text-ink-secondary border border-surface-border',
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
    className: 'bg-surface-elevated text-ink-secondary border border-surface-border',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}

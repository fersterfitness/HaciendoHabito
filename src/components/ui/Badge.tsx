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

const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  activa: {
    label: 'Activa',
    className: 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30',
  },
  activo: {
    label: 'Activo',
    className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  },
  por_vencer: {
    label: 'Por vencer',
    className: 'bg-status-expiring/10 text-status-expiring border border-status-expiring/30',
  },
  vencida: {
    label: 'Vencida',
    className: 'bg-status-expired/10 text-status-expired border border-status-expired/30',
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
    className: 'bg-status-pending/10 text-status-pending border border-status-pending/30',
  },
  en_proceso: {
    label: 'Procesando',
    className: 'bg-status-sent/10 text-status-sent border border-status-sent/30',
  },
  generado: {
    label: 'PDF listo',
    className: 'bg-status-generated/10 text-status-generated border border-status-generated/30',
  },
  enviado: {
    label: 'Enviado',
    className: 'bg-status-generated/20 text-status-generated border border-status-generated/50',
  },
  error: {
    label: 'Error',
    className: 'bg-status-error/10 text-status-error border border-status-error/30',
  },
  recibida: {
    label: 'Recibida',
    className: 'bg-status-pending/10 text-status-pending border border-status-pending/30',
  },
  en_revision: {
    label: 'En revisión',
    className: 'bg-status-expiring/10 text-status-expiring border border-status-expiring/30',
  },
  devuelta: {
    label: 'Devuelta',
    className: 'bg-status-generated/10 text-status-generated border border-status-generated/30',
  },
  cerrada: {
    label: 'Cerrada',
    className: 'bg-surface-border/30 text-ink-muted border border-surface-border/50',
  },
  cobrado: {
    label: 'Cobrado',
    className: 'bg-status-generated/10 text-status-generated border border-status-generated/30',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-surface-border/30 text-ink-muted border border-surface-border/50',
  },
  pausado: {
    label: 'Pausado',
    className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  },
  baja: {
    label: 'Baja',
    className: 'bg-status-expired/10 text-status-expired border border-status-expired/30',
  },
  inicial: {
    label: 'Inicial',
    className: 'bg-surface-elevated text-ink-secondary border border-surface-border',
  },
  intermedio: {
    label: 'Intermedio',
    className: 'bg-brand-primary/5 text-brand-warm border border-brand-warm/20',
  },
  avanzado: {
    label: 'Avanzado',
    className: 'bg-brand-primary/15 text-brand-primary border border-brand-primary/40',
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

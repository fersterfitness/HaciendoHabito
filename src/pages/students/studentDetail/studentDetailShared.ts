import { cn } from '@/lib/utils'

export type SeguimientoTab = 'peso' | 'fuerza' | 'pagos' | 'ciclo'

/** Solapas principales de la ficha / panel lateral. */
export type SheetTab = 'ficha' | 'rutina' | 'nutricion' | 'seguimiento' | 'progreso' | 'habitos'

export const DETAIL_LEVEL_LABEL: Record<string, string> = {
  inicial: 'Inicial',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export function intakeStatusPhrase(status: string): string {
  const m: Record<string, string> = {
    activo: 'Activo',
    inactivo: 'Inactivo',
    pausado: 'Pausado',
    baja: 'Baja',
  }
  return m[status] ?? status
}

export function intakeRoutinePhrase(status: string): string {
  const m: Record<string, string> = {
    activa: 'Activa',
    por_vencer: 'Por vencer',
    vencida: 'Vencida',
    pausada: 'Pausada',
    cancelada: 'Cancelada',
  }
  return m[status] ?? status
}


/** Píldora de estado de rutina (activa = verde; resto semántico). */
export function routineStatusPillClass(status: string, compact = false): string {
  const sizing = compact ? 'px-1.5 py-px text-3xs' : 'px-2 py-0.5 text-3xs'
  const base = cn('rounded border font-semibold uppercase tracking-wide', sizing)
  switch (status) {
    case 'activa':
      return cn(
        base,
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/[0.14] dark:text-emerald-400',
      )
    case 'por_vencer':
      return cn(
        base,
        'border-status-expiring/40 bg-status-expiring/10 text-status-expiring',
      )
    case 'vencida':
      return cn(
        base,
        'border-rose-400/45 bg-rose-500/12 text-rose-800 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-400',
      )
    case 'pausada':
      return cn(
        base,
        'border-status-paused/35 bg-status-paused/15 text-status-paused',
      )
    case 'cancelada':
      return cn(base, 'border-surface-border/60 bg-surface-border/40 text-ink-muted')
    default:
      return cn(base, 'border-surface-border/80 text-ink-secondary')
  }
}

/** Estado de cuenta del alumno en la ficha. */
export function studentAccountStatusChipClass(status: string): string {
  const base = 'rounded border px-1.5 py-0.5'
  switch (status) {
    case 'activo':
      return cn(
        base,
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/[0.14] dark:text-emerald-400',
      )
    case 'pausado':
      return cn(
        base,
        'border-status-expiring/40 bg-status-expiring/10 text-status-expiring',
      )
    case 'inactivo':
      return cn(base, 'border-zinc-400/55 bg-ink-muted/12 text-ink-secondary dark:border-zinc-600')
    case 'baja':
      return cn(base, 'border-rose-400/40 bg-rose-500/10 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-400')
    default:
      return cn(base, 'border-surface-border/80 text-ink-muted')
  }
}

/** Línea de estado en historial de pagos. */
// ─── Epley formula ────────────────────────────────────────────────────────────
export function epley1RM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

// ─── RM percentages table ─────────────────────────────────────────────────────
export const RM_PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60]

import { cn } from '@/lib/utils'

/** Referencia histórica para progreso / detalles que aún lean JS; preferir clases neutras en UI. */
export const INTAKE_FORM_ACCENT = '#ff4800'

/**
 * Barra de plan elegido en la columna del formulario (Ferster / Full / Nutrición).
 * Borde e interior ligeramente más marcados que un input típico para leerse como “resumen activo”.
 */
// En mobile el plan ya está visible en el pill de PublicIntakeFormPage; solo se muestra en desktop.
export const intakePublicSelectedPlanBarClass =
  'mb-3 hidden lg:flex min-h-[2.75rem] items-center gap-2.5 rounded-xl border border-zinc-300/95 bg-gradient-to-r from-white via-zinc-50/95 to-zinc-100/80 px-3 py-2.5 shadow-md shadow-zinc-900/[0.06] border-l-[3px] border-l-zinc-500 dark:border-white/[0.14] dark:border-l-white/45 dark:from-white/[0.12] dark:via-white/[0.07] dark:to-white/[0.03] dark:shadow-[0_10px_36px_rgba(0,0,0,0.38)]'

/** Botones «Siguiente» / «Enviar» en formularios públicos: sin color de marca, solo relieve neutro. */
export const intakeFormCtaButtonClass =
  'inline-flex items-center justify-center gap-1 rounded-lg border border-surface-border bg-surface-elevated px-4 py-2 text-xs font-semibold text-ink-primary shadow-sm transition-colors hover:bg-surface-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/35 dark:focus-visible:ring-zinc-500/40 disabled:cursor-not-allowed disabled:opacity-60'

export function intakeFormFieldLabelClass() {
  return 'block text-xs font-medium text-ink-secondary mb-1'
}

export function intakeFormInputClass(err?: string) {
  return cn(
    'w-full rounded-lg border px-3 py-2 text-sm transition-shadow',
    'bg-surface-input border-surface-inputBorder text-ink-primary placeholder:text-ink-muted',
    'focus:outline-none focus:ring-1 focus:ring-zinc-400/45 focus:border-transparent dark:focus:ring-zinc-500/40',
    err && 'border-status-expired',
  )
}

/** Caja + para adjuntos sin íconos externos */
export function intakeAttachPlusBox() {
  return 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-surface-border text-sm font-medium text-ink-muted'
}

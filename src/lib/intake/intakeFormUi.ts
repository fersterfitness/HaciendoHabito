import { cn } from '@/lib/utils'

/** Referencia histórica para progreso / detalles que aún lean JS; preferir clases neutras en UI. */
export const INTAKE_FORM_ACCENT = '#ff4800'

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

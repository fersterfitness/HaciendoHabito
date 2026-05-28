import { cn } from '@/lib/utils'

export const INTAKE_FORM_ACCENT = 'rgb(var(--ink-primary))'

/** Contenedor del formulario en desktop (aprovecha ancho del panel derecho). */
export function intakeFormPageContainerClass() {
  return cn(
    'w-full max-w-lg mx-auto',
    'lg:mx-0 lg:max-w-none',
    'xl:max-w-2xl 2xl:max-w-[44rem]',
  )
}

/** @deprecated */
export const intakePublicSelectedPlanBarClass =
  'mb-3 hidden lg:flex min-h-[2.75rem] items-center gap-2.5 rounded-xl border border-surface-border bg-surface-elevated/50 px-3 py-2.5'

export function intakeFormSectionClass(className?: string) {
  return cn('space-y-3', className)
}

export function intakeFormSectionTitleClass() {
  return 'text-sm font-medium text-ink-secondary'
}

export function intakeFormSectionDividerClass() {
  return 'border-t border-surface-border/60 pt-4 mt-1'
}

/** CTA Siguiente / Enviar — neutro; acento solo en hover. */
export const intakeFormCtaPrimaryClass = cn(
  'inline-flex h-10 w-full sm:w-auto sm:min-w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-lg px-4',
  'text-sm font-semibold text-white',
  'bg-zinc-800 hover:bg-zinc-900',
  'dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
  'outline-none transition-colors duration-150',
  'focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
  'disabled:cursor-not-allowed disabled:opacity-45',
)

export const intakeFormBackButtonClass = cn(
  'inline-flex h-10 min-w-[5rem] items-center justify-center rounded-lg border border-surface-border/80',
  'bg-transparent px-3.5 text-sm font-medium text-ink-secondary transition-colors',
  'hover:border-surface-border hover:bg-surface-elevated/60 hover:text-ink-primary',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/25',
)

/** @deprecated */
export const intakeFormCtaButtonClass = intakeFormCtaPrimaryClass

export function intakeFormFieldLabelClass() {
  return 'mb-1 block text-sm font-medium text-ink-secondary'
}

export function intakeFormFieldLabelInlineClass() {
  return 'text-sm font-medium text-ink-secondary'
}

export function intakeFormInputClass(err?: string) {
  return cn(
    'w-full rounded-lg border px-3 text-base sm:text-sm transition-colors duration-150',
    'min-h-[2.625rem] py-2',
    'bg-surface-input border-surface-inputBorder/90 text-ink-primary placeholder:text-ink-muted/70',
    'focus:outline-none focus:border-zinc-400/80 focus:ring-2 focus:ring-zinc-400/15',
    err && 'border-status-expired focus:border-status-expired focus:ring-status-expired/15',
  )
}

export function intakeAttachPlusBox() {
  return cn(
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed',
    'border-surface-border bg-surface-elevated/50 text-lg font-medium text-ink-muted',
  )
}

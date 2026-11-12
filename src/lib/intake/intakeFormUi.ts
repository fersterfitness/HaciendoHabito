import { cn } from '@/lib/utils'

export const INTAKE_FORM_ACCENT = 'rgb(var(--ink-primary))'

/** Contenedor del formulario en desktop (aprovecha ancho del panel derecho). */
export function intakeFormPageContainerClass() {
  return cn(
    // Al cambiar de sección el formulario se desplaza a su inicio: el margen deja a la vista el título de la página.
    'scroll-mt-44 w-full max-w-lg mx-auto',
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
  'inline-flex h-11 w-full sm:w-auto sm:min-w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-xl px-5',
  'text-sm font-semibold',
  'bg-ink-primary text-surface-base hover:opacity-90',
  'outline-none transition-[opacity,transform] duration-150 active:scale-[0.98]',
  'focus-visible:ring-2 focus-visible:ring-ink-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-card))]',
  'disabled:cursor-not-allowed disabled:opacity-45',
)

export const intakeFormBackButtonClass = cn(
  'inline-flex h-11 min-w-[5rem] items-center justify-center gap-1.5 rounded-xl',
  'bg-surface-elevated px-4 text-sm font-medium text-ink-primary transition-colors',
  'hover:bg-surface-border',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/30',
)

/** @deprecated */
export const intakeFormCtaButtonClass = intakeFormCtaPrimaryClass

export function intakeFormFieldLabelClass() {
  return 'mb-1.5 block text-body-sm font-medium text-ink-primary'
}

export function intakeFormFieldLabelInlineClass() {
  return 'text-body-sm font-medium text-ink-primary'
}

export function intakeFormInputClass(err?: string) {
  return cn(
    'w-full rounded-xl border px-3.5 text-base sm:text-sm transition-[border-color,box-shadow] duration-150',
    'min-h-[2.75rem] py-2',
    'bg-surface-input border-surface-inputBorder text-ink-primary placeholder:text-ink-muted/70',
    'hover:border-ink-muted/60',
    'focus:outline-none focus:border-ink-primary focus:ring-[3px] focus:ring-ink-primary/10',
    err && 'border-status-expired focus:border-status-expired focus:ring-status-expired/15',
  )
}

export function intakeAttachPlusBox() {
  return cn(
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed',
    'border-surface-border bg-surface-elevated/50 text-lg font-medium text-ink-muted',
  )
}

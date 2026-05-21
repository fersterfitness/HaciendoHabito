import { cn } from '@/lib/utils'
import { secondaryGradientCtaClassName } from '@/lib/primaryGradientCtaClasses'

export const INTAKE_FORM_ACCENT = 'rgb(var(--brand-secondary))'

/** @deprecated */
export const intakePublicSelectedPlanBarClass =
  'mb-3 hidden lg:flex min-h-[2.75rem] items-center gap-2.5 rounded-xl border border-zinc-300/95 bg-gradient-to-r from-white via-zinc-50/95 to-zinc-100/80 px-3 py-2.5'

export function intakeFormSectionClass(className?: string) {
  return cn(
    'space-y-3 rounded-xl border border-surface-border/55 bg-surface-elevated/20 p-3.5 sm:p-4',
    'dark:border-surface-border/45 dark:bg-surface-elevated/10',
    className,
  )
}

export function intakeFormSectionTitleClass() {
  return cn(
    'flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-secondary',
    'before:h-3.5 before:w-0.5 before:shrink-0 before:rounded-full before:bg-brand-secondary before:content-[""]',
  )
}

/** CTA Siguiente / Enviar — acento secondary (sin naranja). */
export const intakeFormCtaPrimaryClass = cn(
  secondaryGradientCtaClassName,
  '!h-11 justify-center text-sm',
)

export const intakeFormBackButtonClass = cn(
  'inline-flex h-11 min-w-[5.5rem] items-center justify-center rounded-xl border border-surface-border/80',
  'bg-transparent px-4 text-sm font-medium text-ink-secondary transition-colors',
  'hover:border-brand-secondary/30 hover:bg-brand-secondary/5 hover:text-ink-primary',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary/30',
)

/** @deprecated */
export const intakeFormCtaButtonClass = intakeFormCtaPrimaryClass

export function intakeFormFieldLabelClass() {
  return 'block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1.5'
}

export function intakeFormFieldLabelInlineClass() {
  return 'text-[11px] font-semibold uppercase tracking-wide text-ink-muted'
}

export function intakeFormInputClass(err?: string) {
  return cn(
    'w-full rounded-xl border px-3.5 text-base sm:text-sm transition-all duration-150',
    'min-h-[2.75rem] py-2.5',
    'bg-surface-input border-surface-inputBorder/90 text-ink-primary placeholder:text-ink-muted/80',
    'focus:outline-none focus:border-brand-secondary/50 focus:ring-2 focus:ring-brand-secondary/18',
    err && 'border-status-expired focus:border-status-expired focus:ring-status-expired/20',
  )
}

export function intakeAttachPlusBox() {
  return cn(
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed',
    'border-brand-secondary/35 bg-brand-secondary/5 text-sm font-medium text-brand-secondary',
  )
}

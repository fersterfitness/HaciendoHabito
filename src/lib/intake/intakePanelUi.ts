import { cn } from '@/lib/utils'
import { intakeFormCtaPrimaryClass } from '@/lib/intake/intakeFormUi'

/** Etiqueta de grupo en panel izquierdo (Modalidad, Ofertas…). */
export function intakePanelGroupLabelClass(theme: 'light' | 'dark') {
  return cn(
    'mb-1.5 block text-xs font-medium',
    theme === 'dark' ? 'text-white/55' : 'text-ink-muted',
  )
}

/** Superficie principal del panel (modalidad + planes). */
export function intakePanelSurfaceClass(theme: 'light' | 'dark') {
  return cn(
    'relative z-[1] rounded-xl border p-2.5 sm:p-3',
    theme === 'dark'
      ? 'border-white/10 bg-white/[0.03] text-white'
      : 'border-surface-border bg-surface-card text-ink-primary',
  )
}

/** Opción seleccionada en segmented control (panel). */
export function intakePanelSegmentSelectedClass(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? cn('!text-white border-white/25 bg-white/[0.08] font-semibold ring-1 ring-white/15')
    : cn('border-surface-border bg-surface-elevated font-semibold text-ink-primary ring-1 ring-zinc-300/60')
}

export function intakePanelSegmentIdleClass(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? '!text-white/58 border-white/10 bg-transparent font-medium hover:!text-white/85 hover:border-white/18'
    : 'border-surface-border bg-transparent font-medium text-ink-muted hover:border-surface-border hover:text-ink-secondary'
}

/** CTA en bloque de planes (mismo neutro que el formulario). */
export const intakePanelPlansCtaClass = cn(intakeFormCtaPrimaryClass, 'w-full sm:min-w-[8.5rem]')

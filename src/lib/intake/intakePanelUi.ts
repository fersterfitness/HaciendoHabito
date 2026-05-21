import { cn } from '@/lib/utils'
import { secondaryGradientCtaClassName } from '@/lib/primaryGradientCtaClasses'

/** Etiqueta de grupo en panel izquierdo (Modalidad, Ofertas…). */
export function intakePanelGroupLabelClass(theme: 'light' | 'dark') {
  return cn(
    'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em]',
    theme === 'dark' ? 'text-brand-secondary/75' : 'text-ink-muted',
  )
}

/** Superficie principal del panel (modalidad + planes). */
export function intakePanelSurfaceClass(theme: 'light' | 'dark') {
  return cn(
    'relative z-[1] rounded-2xl border p-3.5 backdrop-blur-md sm:p-4',
    theme === 'dark'
      ? 'border-brand-secondary/20 bg-white/[0.04] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
      : 'border-brand-secondary/15 bg-surface-card/95 text-ink-primary shadow-sm',
  )
}

/** Opción seleccionada en segmented control (panel). */
export function intakePanelSegmentSelectedClass(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? cn(
        '!text-white border-brand-secondary/50 bg-brand-secondary/18 font-semibold',
        'ring-1 ring-brand-secondary/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
      )
    : cn(
        'border-brand-secondary/40 bg-brand-secondary/10 font-semibold text-brand-secondary',
        'ring-1 ring-brand-secondary/20 shadow-[0_2px_12px_rgba(169,121,255,0.1)]',
      )
}

export function intakePanelSegmentIdleClass(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? '!text-white/55 border-white/10 bg-white/[0.02] font-medium hover:!text-white/85 hover:border-brand-secondary/25'
    : 'border-surface-border bg-surface-card font-medium text-ink-muted hover:border-brand-secondary/25 hover:text-ink-secondary'
}

/** CTA «Continuar» / «Ver detalle» en bloque de planes. */
export const intakePanelPlansCtaClass = cn(
  secondaryGradientCtaClassName,
  'w-full !h-11 justify-center sm:w-auto sm:min-w-[9.5rem]',
)

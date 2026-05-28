import { cn } from '@/lib/utils'
import { primaryGradientCtaClassName } from '@/lib/primaryGradientCtaClasses'

/** Etiqueta de grupo en panel izquierdo (Modalidad, Ofertas…). */
export function intakePanelGroupLabelClass(theme: 'light' | 'dark') {
  return cn(
    'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em]',
    theme === 'dark' ? 'text-white/58' : 'text-ink-muted',
  )
}

/** Superficie principal del panel (modalidad + planes). */
export function intakePanelSurfaceClass(theme: 'light' | 'dark') {
  return cn(
    'relative z-[1] rounded-2xl border p-2.5 backdrop-blur-md sm:p-3',
    theme === 'dark'
      ? 'border-white/12 bg-white/[0.04] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
      : 'border-surface-border bg-surface-card/95 text-ink-primary shadow-sm',
  )
}

/** Opción seleccionada en segmented control (panel). */
export function intakePanelSegmentSelectedClass(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? cn(
        '!text-white border-white/28 bg-white/[0.1] font-semibold',
        'ring-1 ring-[#ff6a00]/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
      )
    : cn(
        'border-surface-border bg-surface-elevated font-semibold text-ink-primary',
        'ring-1 ring-[#ff6a00]/20 shadow-[0_2px_12px_rgba(255,106,0,0.08)]',
      )
}

export function intakePanelSegmentIdleClass(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? '!text-white/58 border-white/10 bg-white/[0.02] font-medium hover:!text-white/85 hover:border-white/20'
    : 'border-surface-border bg-surface-card font-medium text-ink-muted hover:border-surface-border/80 hover:text-ink-secondary'
}

/** CTA «Continuar» / «Ver detalle» en bloque de planes. */
export const intakePanelPlansCtaClass = cn(
  primaryGradientCtaClassName,
  'w-full !h-11 justify-center sm:w-auto sm:min-w-[9.5rem]',
)

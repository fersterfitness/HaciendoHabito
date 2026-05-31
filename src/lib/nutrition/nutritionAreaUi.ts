import { cn } from '@/lib/utils'

/** Shell de listados del nutricionista (Pacientes, Planes, Biblioteca). */
export const nutritionShellClass = 'space-y-5'

/** Contenedor de pestañas de área (Planes / Biblioteca) o barra contextual en Pacientes. */
export const nutritionTabsStripClass =
  'rounded-xl border border-surface-border/80 bg-surface-card/70 shadow-sm backdrop-blur-sm'

/** Kicker de bloque hero / destacado. */
export const nutritionKickerClass =
  'text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-secondary/90'

/** Superficie de panel (tablas, formularios, bloques). */
export const nutritionPanelClass =
  'rounded-2xl border border-surface-border/80 bg-surface-card shadow-card'

/** Fila interactiva en listados (planes, alimentos). */
export const nutritionListRowClass =
  'rounded-2xl border border-surface-border/70 bg-surface-card shadow-sm transition-colors'

export const nutritionListRowHoverClass =
  'hover:border-brand-secondary/35 hover:shadow-card'

export const nutritionListRowActiveClass =
  'border-brand-secondary/50 bg-brand-secondary/[0.06] shadow-card'

/** Título de subsección dentro de una página (alineado a PageSectionTitle). */
export const nutritionSectionTitleClass =
  'text-xs font-semibold uppercase tracking-widest text-ink-muted'

export const nutritionSectionDescClass = 'mt-1 max-w-prose text-sm text-ink-secondary'

/** Inputs y textareas en vistas de nutrición. */
export const nutritionInputClass = cn(
  'rounded-xl border border-surface-border/80 bg-surface-input text-ink-primary outline-none transition-shadow',
  'placeholder:text-ink-muted focus:border-brand-secondary/50 focus:ring-2 focus:ring-brand-secondary/20',
)

export const nutritionMetaClass = 'text-xs leading-snug text-ink-muted'

export const nutritionHintClass = 'text-[11px] leading-snug text-ink-muted'

export const nutritionLabelClass =
  'mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted'

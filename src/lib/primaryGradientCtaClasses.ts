import { cn } from '@/lib/utils'

/** Texto/icono CTA entrenador (derivado de brand primary). */
export const trainerCtaAccentTextClassName = 'text-brand-primary dark:text-brand-primary/80'

/** Badge / pastilla sólida tipo marca naranja (p. ej. contador en campana). */
export const trainerCtaSolidBgClassName = 'bg-brand-primary dark:bg-brand-hover'

/** `accent-color` en checkboxes/radios alineado al CTA entrenador. */
export const trainerCtaFormAccentClassName =
  'accent-[#ff5508] dark:accent-[#ffa065]'

/** Checkboxes en Gestionar Planes Web (verde, no naranja CTA). */
export const webPlansFormCheckboxAccentClassName =
  'accent-green-600 dark:accent-green-500 focus:ring-green-500/35'

/** Borde de foco en inputs “crudos” alineado al CTA naranja. */
export const trainerCtaFocusBorderClassName =
  'focus:border-[#ff5508] dark:focus:border-[#ffa065]'

/** Borde + anillo focus en selects/textarea (sin `--brand-primary` verde). */
export const trainerCtaFocusInputChromeClassName = cn(
  trainerCtaFocusBorderClassName,
  'focus:ring-2 focus:ring-brand-primary/25 dark:focus:ring-brand-primary/28',
)

/** Fondo suave tipo item activo (nav móvil, etc.). */
export const trainerCtaTintBgClassName = 'bg-[#ff5508]/10 dark:bg-[#ff5508]/16'

/** Ítem activo en barra / drawer móvil (acento secondary, no naranja CTA). */
export const mobileNavActiveTextClassName = 'text-brand-secondary'
export const mobileNavActiveTintBgClassName =
  'bg-brand-secondary/10 dark:bg-brand-secondary/16'

/** CTA naranja de marca (degradé + halo, ver `.hh-cta` en index.css). */
export const primaryGradientCtaClassName = cn(
  'hh-cta inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white',
  'outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
)

/** Chip de filtro activo junto a la barra de listados. */
export const directoryFilterChipClassName = cn(
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-primary/25',
  'bg-brand-primary/[0.07] px-3 text-xs font-medium text-ink-primary',
)

/** Separador en popovers de filtros/orden. */
export const directoryPopoverDividerClassName = 'border-t border-surface-border/70 pt-2'

/** Botones secundarios de barra (Exportar, Filtrar, Ordenar) en listados. */
export const directoryToolbarBtnClassName = cn(
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-surface-border',
  'bg-surface-card px-3 text-sm font-medium text-ink-secondary sm:px-3.5',
  'shadow-[var(--highlight-top),var(--shadow-xs)] outline-none transition-all duration-200',
  'hover:border-surface-inputBorder hover:bg-surface-elevated hover:text-ink-primary',
  'active:scale-[0.98]',
  'focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
)

/** CTA de listados: tinte de marca suave (menos peso que el degradé). */
export const secondaryGradientCtaClassName = cn(
  'inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold',
  'border border-brand-primary/25 bg-brand-primary/10 text-brand-primary dark:text-[#ff8a4d]',
  'shadow-[var(--highlight-top)] outline-none transition-all duration-200',
  'hover:border-brand-primary/40 hover:bg-brand-primary/15 hover:shadow-[0_6px_20px_-8px_rgb(var(--brand-primary)/0.45)]',
  'active:scale-[0.98]',
  'focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
  '[&_svg]:shrink-0',
)

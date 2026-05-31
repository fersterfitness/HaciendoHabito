import { cn } from '@/lib/utils'

/** Texto/icono CTA entrenador (derivado de brand primary). */
export const trainerCtaAccentTextClassName = 'text-brand-primary dark:text-brand-primary/80'

/** Badge / pastilla sólida tipo marca naranja (p. ej. contador en campana). */
export const trainerCtaSolidBgClassName = 'bg-brand-primary dark:bg-brand-hover'

/** `accent-color` en checkboxes/radios alineado al CTA entrenador. */
export const trainerCtaFormAccentClassName =
  'accent-[#ff5508] dark:accent-[#ffa065]'

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

/** CTA naranja sólido (formularios públicos, guardar en ajustes). Listados usan `secondaryGradientCtaClassName`. */
export const primaryGradientCtaClassName = cn(
  'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-white',
  'bg-gradient-to-r from-[#ff8f5c] from-0% via-[#ff5508] via-50% to-[#b32700] to-100%',
  'shadow-sm shadow-black/10 outline-none transition-[filter,box-shadow] duration-200',
  'hover:from-[#ffa06e] hover:via-[#ff6014] hover:to-[#c03100]',
  'hover:shadow-md hover:shadow-black/15',
  'active:brightness-[0.97]',
  'dark:from-[#ff9050] dark:via-[#f04a00] dark:to-[#9c2200] dark:shadow-black/50',
  'dark:hover:from-[#ffa065] dark:hover:via-[#ff5c14] dark:hover:to-[#af2800]',
  'focus-visible:ring-2 focus-visible:ring-brand-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
  'dark:focus-visible:ring-offset-zinc-900',
)

/** Chip de filtro activo junto a la barra de listados. */
export const directoryFilterChipClassName = cn(
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-border/80',
  'bg-surface-card/50 px-2.5 text-xs font-medium text-ink-primary',
)

/** Separador en popovers de filtros/orden. */
export const directoryPopoverDividerClassName = 'border-t border-surface-border/70 pt-2'

/** Botones secundarios de barra (Exportar, Filtrar, Ordenar) en listados. */
export const directoryToolbarBtnClassName = cn(
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-surface-border/80',
  'bg-surface-card/40 px-3 text-sm font-medium text-ink-secondary sm:px-3.5',
  'outline-none transition-colors duration-200',
  'hover:border-surface-border hover:bg-surface-elevated/50 hover:text-ink-primary',
  'focus-visible:ring-2 focus-visible:ring-brand-secondary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
  'dark:bg-surface-elevated/20 dark:hover:bg-surface-elevated/45',
)

/** CTA principal en listados: acento secondary moderno (outline + tinte, no bloque sólido). */
export const secondaryGradientCtaClassName = cn(
  'inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold',
  'border border-brand-secondary/40 text-brand-secondary',
  'bg-gradient-to-br from-brand-secondary/[0.14] via-brand-secondary/[0.06] to-transparent',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none',
  'transition-all duration-200',
  'hover:border-brand-secondary/55 hover:from-brand-secondary/[0.2] hover:to-brand-secondary/[0.04]',
  'hover:shadow-[0_4px_16px_rgba(169,121,255,0.14)]',
  'active:scale-[0.99]',
  'focus-visible:ring-2 focus-visible:ring-brand-secondary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
  '[&_svg]:shrink-0 [&_svg]:text-brand-secondary',
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
)

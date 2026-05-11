import { cn } from '@/lib/utils'

/** Texto/icono alineado al CTA naranja (entrenador); no usa `--brand-primary` del rol nutricionista. */
export const trainerCtaAccentTextClassName =
  'text-[#ff5508] dark:text-[#ffa065]'

/** Badge / pastilla sólida tipo marca naranja (p. ej. contador en campana). */
export const trainerCtaSolidBgClassName = 'bg-[#ff4800] dark:bg-[#f04a00]'

/** `accent-color` en checkboxes/radios alineado al CTA entrenador. */
export const trainerCtaFormAccentClassName =
  'accent-[#ff5508] dark:accent-[#ffa065]'

/** Borde de foco en inputs “crudos” alineado al CTA naranja. */
export const trainerCtaFocusBorderClassName =
  'focus:border-[#ff5508] dark:focus:border-[#ffa065]'

/** Borde + anillo focus en selects/textarea (sin `--brand-primary` verde). */
export const trainerCtaFocusInputChromeClassName = cn(
  trainerCtaFocusBorderClassName,
  'focus:ring-2 focus:ring-[#ff4800]/25 dark:focus:ring-[#ffa065]/28',
)

/** Fondo suave tipo item activo (nav móvil, etc.). */
export const trainerCtaTintBgClassName = 'bg-[#ff5508]/10 dark:bg-[#ff5508]/16'

/** Estilo compartido del CTA naranja (degradé horizontal): Nuevo alumno, Nueva rutina, Nuevo plan, etc. */
export const primaryGradientCtaClassName = cn(
  'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-white',
  'bg-gradient-to-r from-[#ff8f5c] from-0% via-[#ff5508] via-50% to-[#b32700] to-100%',
  'shadow-sm shadow-black/10 outline-none transition-[filter,box-shadow] duration-200',
  'hover:from-[#ffa06e] hover:via-[#ff6014] hover:to-[#c03100]',
  'hover:shadow-md hover:shadow-black/15',
  'active:brightness-[0.97]',
  'dark:from-[#ff9050] dark:via-[#f04a00] dark:to-[#9c2200] dark:shadow-black/50',
  'dark:hover:from-[#ffa065] dark:hover:via-[#ff5c14] dark:hover:to-[#af2800]',
  'focus-visible:ring-2 focus-visible:ring-[#ff4800]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
  'dark:focus-visible:ring-offset-zinc-900',
)

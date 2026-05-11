import { cn } from '@/lib/utils'

/**
 * Anillo `focus-visible` compartido (inputs, botones, iconos del header).
 * Offset sigue el lienzo para que el anillo no se “coma” el borde.
 */
export const appFocusRingClassName = cn(
  'focus:outline-none',
  'focus-visible:ring-2 focus-visible:ring-brand-secondary/45 focus-visible:ring-offset-2',
  'focus-visible:ring-offset-[rgb(var(--surface-base))] dark:focus-visible:ring-offset-zinc-900',
)

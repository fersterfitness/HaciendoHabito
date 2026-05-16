import { cn } from '@/lib/utils'

/** Fila de inbox con prioridad — acento suave (secondary), sin bloques naranja fuertes. */
export function inboxHighlightCardClassName(active: boolean): string {
  return cn(
    active &&
      'border-l-[3px] border-l-brand-secondary/45 bg-brand-secondary/[0.06] dark:bg-brand-secondary/[0.08] pl-[calc(1rem-3px)]',
  )
}

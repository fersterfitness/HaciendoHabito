import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { cn } from '@/lib/utils'

/**
 * La única pestaña de la v2: pastilla, la elegida en negro. Vale para secciones, filtros y vistas,
 * así toda la app se lee igual. `sm` es la misma pieza más chica (barras de herramientas, tarjetas).
 */
export const v2TabListClass = 'inline-flex max-w-full items-center gap-1.5'

export function v2TabClass(active: boolean, size: 'sm' | 'md' = 'md') {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors',
    appFocusRingClassName,
    size === 'sm' ? 'h-7 px-3 text-[12.5px]' : 'h-8 px-3.5 text-[13px]',
    active ? 'bg-ink-primary text-surface-base' : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary',
  )
}

/** Número al lado de la etiqueta (mismo formato en todas las pestañas). */
export function v2TabCountClass(active: boolean) {
  return cn('tabular-nums', active ? 'opacity-70' : 'text-ink-muted')
}

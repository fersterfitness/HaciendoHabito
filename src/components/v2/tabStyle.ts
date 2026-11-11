import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { cn } from '@/lib/utils'

/**
 * Pastilla de la v2, la elegida en negro: filtros y vistas. Las secciones de una ficha (`<Tabs>`) van
 * como texto con subrayado, para que no se confundan con un filtro. `sm` es la misma pieza más chica.
 */
export const v2TabListClass = 'inline-flex max-w-full items-center gap-1.5'

export function v2TabClass(active: boolean, size: 'sm' | 'md' = 'md') {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[0.625rem] font-medium transition-colors',
    appFocusRingClassName,
    size === 'sm' ? 'h-7 px-3 text-[12.5px]' : 'h-8 px-3.5 text-[13px]',
    active ? 'bg-ink-primary text-surface-base' : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary',
  )
}

/** Número al lado de la etiqueta (mismo formato en todas las pestañas). */
export function v2TabCountClass(active: boolean) {
  return cn('tabular-nums', active ? 'opacity-70' : 'text-ink-muted')
}

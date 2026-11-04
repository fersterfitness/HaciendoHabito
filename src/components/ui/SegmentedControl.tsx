import { type ReactNode, useId } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { IS_V2 } from '@/lib/uiVersion'
import { v2TabClass, v2TabCountClass } from '@/components/v2/tabStyle'
import { cn } from '@/lib/utils'

export type SegmentedItem = {
  id: string
  label: ReactNode
  icon?: LucideIcon
  count?: number
  /** Si viene, el ítem es un link de ruta (la ruta activa decide la selección). */
  to?: string
  end?: boolean
  title?: string
}

const SIZE = {
  sm: { wrap: 'gap-1', item: 'h-7 px-2.5 text-xs gap-1.5 rounded-md', icon: 'h-3.5 w-3.5' },
  md: { wrap: 'gap-5 border-b border-surface-border', item: 'h-10 text-sm gap-2', icon: 'h-4 w-4' },
} as const

/**
 * Control de pestañas único de la app, en dos tamaños:
 * - `md` (secciones): pestañas con subrayado que se desliza, alineadas a la izquierda.
 * - `sm` (filtros): «chips» livianos, el activo con fondo gris.
 * Sirve para navegación entre secciones (`to`) y para pestañas internas (`value` / `onChange`).
 */
export function SegmentedControl({
  items,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  ariaLabel,
  className,
}: {
  items: SegmentedItem[]
  value?: string
  onChange?: (id: string) => void
  size?: keyof typeof SIZE
  fullWidth?: boolean
  ariaLabel?: string
  className?: string
}) {
  const pillId = useId()
  const reduceMotion = useReducedMotion()
  const sz = SIZE[size]

  function content(item: SegmentedItem, active: boolean) {
    const Icon = item.icon
    return (
      <>
        {active && !IS_V2 ? (
          <motion.span
            layoutId={pillId}
            aria-hidden
            className={cn(
              'absolute -z-10',
              size === 'sm'
                ? 'inset-0 rounded-md bg-ink-primary/[0.07] dark:bg-white/[0.09]'
                : 'inset-x-0 bottom-0 h-0.5 rounded-full bg-ink-primary',
            )}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 36 }}
          />
        ) : null}
        {Icon ? <Icon className={cn(sz.icon, 'shrink-0', !active && 'opacity-80')} aria-hidden /> : null}
        <span className="truncate">{item.label}</span>
        {typeof item.count === 'number' && IS_V2 ? <span className={v2TabCountClass(active)}>{item.count}</span> : null}
        {typeof item.count === 'number' && !IS_V2 ? (
          <span
            className={cn(
              'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-3xs font-semibold tabular-nums',
              IS_V2
                ? active
                  ? 'bg-surface-base/20 text-surface-base'
                  : 'bg-surface-border text-ink-muted'
                : active
                  ? 'bg-brand-primary/[0.12] text-brand-primary'
                  : 'bg-surface-border/70 text-ink-muted',
            )}
          >
            {item.count}
          </span>
        ) : null}
      </>
    )
  }

  const itemBase = (active: boolean) =>
    IS_V2
      ? v2TabClass(active, size)
      : cn(
      'relative isolate inline-flex select-none items-center justify-center font-medium whitespace-nowrap',
      'transition-colors duration-200',
      appFocusRingClassName,
      sz.item,
      // No se achican: si no entran, el control se desliza en vez de cortar las etiquetas.
      fullWidth && size === 'sm' ? 'min-w-0 flex-1' : 'shrink-0',
      active ? 'text-ink-primary' : 'text-ink-muted hover:text-ink-primary',
    )

  return (
    <div
      role={items.some((i) => i.to) ? 'navigation' : 'tablist'}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex max-w-full items-center overflow-x-auto scrollbar-hide',
        IS_V2 ? 'gap-1.5' : sz.wrap,
        !IS_V2 && (fullWidth || size === 'md') && 'flex w-full',
        className,
        // Las secciones ocupan todo el ancho: la línea de abajo corre de lado a lado.
        size === 'md' && 'max-w-full',
      )}
    >
      {items.map((item) =>
        item.to ? (
          <NavLink key={item.id} to={item.to} end={item.end} title={item.title} className={({ isActive }) => itemBase(isActive)}>
            {({ isActive }) => content(item, isActive)}
          </NavLink>
        ) : (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={value === item.id}
            title={item.title}
            onClick={() => onChange?.(item.id)}
            className={itemBase(value === item.id)}
          >
            {content(item, value === item.id)}
          </button>
        ),
      )}
    </div>
  )
}

import { type ReactNode, useId } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
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
  sm: { wrap: 'p-0.5 rounded-full', item: 'h-7 px-3 text-2xs gap-1.5 rounded-full', icon: 'h-3.5 w-3.5' },
  md: { wrap: 'p-1 rounded-xl', item: 'h-9 px-3 text-xs gap-1.5 rounded-lg', icon: 'h-4 w-4' },
} as const

/**
 * Control segmentado único de la app: pastilla que se desliza a la opción activa.
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
        {active ? (
          <motion.span
            layoutId={pillId}
            aria-hidden
            className={cn(
              'absolute inset-0 -z-10 border border-surface-border bg-surface-card shadow-[var(--highlight-top),var(--shadow-xs)]',
              size === 'sm' ? 'rounded-full' : 'rounded-lg',
              'dark:border-white/[0.08] dark:bg-surface-panel',
            )}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 36 }}
          />
        ) : null}
        {Icon ? <Icon className={cn(sz.icon, 'shrink-0', active ? 'text-brand-primary' : 'opacity-80')} aria-hidden /> : null}
        <span className="truncate">{item.label}</span>
        {typeof item.count === 'number' ? (
          <span
            className={cn(
              'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-3xs font-bold tabular-nums',
              active ? 'bg-brand-primary/12 text-brand-primary' : 'bg-surface-border/70 text-ink-muted',
            )}
          >
            {item.count}
          </span>
        ) : null}
      </>
    )
  }

  const itemBase = (active: boolean) =>
    cn(
      'relative isolate inline-flex select-none items-center justify-center font-semibold whitespace-nowrap',
      'transition-colors duration-200',
      appFocusRingClassName,
      sz.item,
      // Sin ancho completo no se achican: si no entran, el control se desliza en vez de cortar las etiquetas.
      fullWidth ? 'min-w-0 flex-1' : 'shrink-0',
      active ? 'text-ink-primary' : 'text-ink-muted hover:text-ink-primary',
    )

  return (
    <div
      role={items.some((i) => i.to) ? 'navigation' : 'tablist'}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 overflow-x-auto scrollbar-hide border border-surface-border/80 bg-surface-elevated/60',
        sz.wrap,
        fullWidth && 'flex w-full',
        className,
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

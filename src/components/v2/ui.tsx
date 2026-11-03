import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { avatarToneClass, cn, getInitials } from '@/lib/utils'

/**
 * Piezas de la v2. Pocas y con una sola forma de usarse: así las pantallas nuevas salen parejas
 * sin estilos a mano.
 */

/** Contenedor de página: ancho máximo y márgenes iguales en todas las pantallas nuevas. */
export function PageV2({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[72rem] px-4 pb-12 pt-6 lg:px-8 lg:pt-8', className)}>{children}</div>
}

export function PageHeaderV2({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink-primary lg:text-[30px]">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Tira de números del mes: una sola caja dividida, sin tarjetas sueltas. */
export function StatStrip({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode }[] }) {
  return (
    <div className="mb-7 grid grid-cols-2 overflow-hidden rounded-xl border border-surface-border bg-surface-card lg:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn(
            'px-4 py-4 lg:px-5',
            i % 2 === 1 && 'border-l border-surface-border',
            i >= 2 && 'border-t border-surface-border lg:border-t-0',
            i === 2 && 'lg:border-l',
          )}
        >
          <p className="text-[12px] font-medium text-ink-muted">{it.label}</p>
          <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink-primary lg:text-2xl">{it.value}</p>
          {it.hint ? <p className="mt-1.5 truncate text-[12px] text-ink-muted">{it.hint}</p> : null}
        </div>
      ))}
    </div>
  )
}

/** Bloque con título y, opcional, una acción a la derecha. */
export function PanelV2({
  title,
  count,
  action,
  children,
  className,
}: {
  title: string
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-surface-border bg-surface-card', className)}>
      <header className="flex h-11 items-center gap-2 border-b border-surface-border px-4">
        <h2 className="text-[13px] font-semibold text-ink-primary">{title}</h2>
        {count ? <span className="rounded-md bg-surface-elevated px-1.5 text-[11px] font-medium tabular-nums text-ink-secondary">{count}</span> : null}
        <div className="ml-auto">{action}</div>
      </header>
      {children}
    </section>
  )
}

/** Separador con nombre dentro de un panel (agrupa filas). */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="bg-surface-panel/60 px-4 pb-1.5 pt-3 text-[11px] font-medium text-ink-muted">{children}</p>
}

export function IconBubble({ icon: Icon, tone = 'neutral' }: { icon: LucideIcon; tone?: 'neutral' | 'warning' | 'danger' | 'success' | 'info' | 'brand' }) {
  const color = {
    neutral: 'text-ink-secondary',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    info: 'text-sky-600 dark:text-sky-400',
    brand: 'text-brand-primary',
  }[tone]
  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-base', color)} aria-hidden>
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  )
}

export function InitialsV2({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', avatarToneClass(name), className)}
      aria-hidden
    >
      {getInitials(name)}
    </span>
  )
}

/** Fila de lista: algo a la izquierda (ícono o avatar), texto y acciones. */
export function RowV2({
  leading,
  title,
  meta,
  trailing,
  onClick,
}: {
  leading?: ReactNode
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors',
        onClick && 'cursor-pointer hover:bg-surface-elevated/50',
      )}
      onClick={onClick}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink-primary">{title}</p>
        {meta ? <p className="mt-0.5 truncate text-[12px] text-ink-muted">{meta}</p> : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {trailing}
        </div>
      ) : null}
    </div>
  )
}

/** Botón chico de fila: gris, con ícono opcional. */
export function RowAction({
  icon: Icon,
  children,
  onClick,
  title,
  iconClassName,
}: {
  icon?: LucideIcon | ((p: { className?: string }) => ReactNode)
  children?: ReactNode
  onClick: () => void
  title?: string
  iconClassName?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-surface-border bg-surface-base px-2.5 text-[12px] font-medium text-ink-primary transition-colors hover:bg-surface-elevated"
    >
      {Icon ? <Icon className={cn('h-3.5 w-3.5', iconClassName ?? 'text-ink-muted')} /> : null}
      {children}
    </button>
  )
}

export function EmptyRowV2({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-[13px] text-ink-muted">{children}</p>
}

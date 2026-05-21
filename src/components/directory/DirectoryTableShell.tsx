import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function DirectoryTableShell({
  title,
  subtitle,
  count,
  children,
  className,
}: {
  title: string
  subtitle?: string
  count?: number
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-surface-border/80 bg-surface-card shadow-card',
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-surface-border/70 bg-surface-elevated/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-ink-primary">{title}</h2>
          {subtitle ? <p className="truncate text-label text-ink-muted">{subtitle}</p> : null}
        </div>
        {count != null ? (
          <span className="inline-flex items-center rounded-full border border-surface-border/70 bg-surface-card px-2.5 py-1 text-label font-semibold tabular-nums text-ink-secondary">
            {count === 1 ? '1 registro' : `${count} registros`}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

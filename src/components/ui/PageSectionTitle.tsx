import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageSectionTitleProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** Título de sección reutilizable (Inicio, listados largos). */
export function PageSectionTitle({ title, description, action, className }: PageSectionTitleProps) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-2', className)}>
      <div className="min-w-0">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-ink-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

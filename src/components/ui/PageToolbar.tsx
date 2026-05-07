import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageToolbarProps {
  children: ReactNode
  className?: string
  /** Título opcional encima del contenido de la barra (Gray-style). */
  title?: string
  description?: string
}

export function PageToolbar({ children, className, title, description }: PageToolbarProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-border bg-surface-elevated/70 dark:bg-surface-elevated/40 p-3 sm:p-4 space-y-3',
        className,
      )}
    >
      {(title || description) && (
        <div className="min-w-0">
          {title && <p className="text-sm font-semibold text-ink-primary">{title}</p>}
          {description && <p className="text-xs text-ink-secondary mt-0.5">{description}</p>}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center min-w-0">
        {children}
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'
import { EmptyState } from './EmptyState'

interface AsyncStateProps {
  loading: boolean
  error?: string | null
  /** Cuando true y no hay loading ni error, muestra `empty`. */
  empty?: boolean
  emptyState?: {
    title: string
    description?: string
    icon?: ReactNode
    action?: { label: string; onClick: () => void; icon?: ReactNode }
  }
  loadingContent?: ReactNode
  children: ReactNode
  className?: string
}

export function AsyncState({
  loading,
  error,
  empty,
  emptyState,
  loadingContent,
  children,
  className,
}: AsyncStateProps) {
  if (loading) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16', className)}>
        {loadingContent ?? <Spinner size="lg" />}
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('py-8', className)}>
        <EmptyState
          title="No se pudo cargar"
          description={error}
        />
      </div>
    )
  }

  if (empty && emptyState) {
    return (
      <div className={className}>
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
          action={emptyState.action}
        />
      </div>
    )
  }

  return <>{children}</>
}

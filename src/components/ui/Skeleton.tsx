import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-surface-elevated', className)}
      style={style}
    />
  )
}

/** Skeleton de una fila de tabla de alumnos/rutinas */
export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  const colWidths = ['w-40', 'w-20', 'w-16', 'w-28', 'w-20']
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
      <Skeleton className="h-3.5 w-36" />
      <div className="flex-1" />
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', colWidths[i] ?? 'w-20')} />
      ))}
    </div>
  )
}

/** Skeleton completo de tabla con cabecera */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center gap-8 px-5 py-3 border-b border-surface-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn('h-2.5', i === 0 ? 'w-20' : 'w-14')} />
        ))}
      </div>
      {/* Filas */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn(i < rows - 1 && 'border-b border-surface-border')}>
          <TableRowSkeleton cols={cols} />
        </div>
      ))}
    </div>
  )
}

/** Skeleton de stat card */
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>
      <Skeleton className="h-7 w-16" />
    </div>
  )
}

/** Skeleton de card genérica con título y filas */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-5 w-10 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton del gráfico de área */
export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      {/* Barras simulando el gráfico */}
      <div className="flex items-end gap-2 h-[140px] pt-4">
        {[65, 40, 80, 55, 90, 70].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end gap-1">
            <Skeleton className="w-full rounded-sm" style={{ height: `${h}%` }} />
          </div>
        ))}
      </div>
      {/* Labels eje X */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-2 rounded-sm" />
        ))}
      </div>
    </div>
  )
}

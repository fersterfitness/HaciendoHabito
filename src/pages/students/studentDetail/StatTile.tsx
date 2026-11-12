import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Cifra destacada de la ficha (v2): etiqueta, valor grande y una línea de contexto. */
export function StatTile({
  label,
  value,
  unit,
  hint,
  action,
  children,
  className,
}: {
  label: string
  value?: ReactNode
  unit?: string
  hint?: ReactNode
  /** Botón chico a la derecha de la etiqueta («Cambiar»). */
  action?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-xl bg-surface-elevated/60 p-3.5', className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-ink-muted">{label}</span>
        {action}
      </div>
      {value != null ? (
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink-primary">
          {value}
          {unit ? <span className="ml-1 text-sm font-normal text-ink-muted">{unit}</span> : null}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      {children}
    </div>
  )
}

/** Pastilla de estado plana: verde para «bien», amarillo para «pendiente». */
export function StatusPill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-md px-2 py-1 text-xs font-semibold',
        ok ? 'bg-status-ok/15 text-status-ok-ink' : 'hh-pastel bg-pastel-butter text-pastel-butter-ink',
      )}
    >
      {children}
    </span>
  )
}

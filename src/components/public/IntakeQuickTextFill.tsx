import { cn } from '@/lib/utils'

const pillClass =
  'inline-flex shrink-0 items-center rounded-md border border-surface-border bg-surface-card px-2.5 py-1 text-[11px] font-semibold tracking-tight text-ink-secondary shadow-sm transition-colors hover:bg-surface-elevated hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/35 dark:focus-visible:ring-zinc-500/40 active:scale-[0.98]'

type IntakeQuickTextFillProps = {
  /** Texto que se escribe en el campo al tocar. */
  fillValue?: string
  /** Texto del botón (por defecto igual que `fillValue`). */
  label?: string
  onFill: (text: string) => void
  className?: string
}

/**
 * Acceso rápido para campos de texto libre típicos «ninguno / ninguna».
 * Colocar al costado de la etiqueta con un contenedor flex.
 */
export function IntakeQuickTextFill({
  fillValue = 'Ninguno',
  label,
  onFill,
  className,
}: IntakeQuickTextFillProps) {
  const show = label ?? fillValue
  return (
    <button
      type="button"
      className={cn(pillClass, className)}
      onClick={() => onFill(fillValue)}
      title={`Completar el campo con «${fillValue}»`}
    >
      {show}
    </button>
  )
}

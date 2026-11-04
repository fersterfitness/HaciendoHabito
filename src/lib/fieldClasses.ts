import { cn } from '@/lib/utils'

/**
 * Estilo común de los campos de formulario. Lo usan `Input`, `Textarea` y `Select` y cualquier
 * campo armado a mano (tablas, modales chicos), así todos se ven y responden igual.
 */
export const fieldClassName = cn(
  'w-full rounded-xl border border-surface-inputBorder bg-surface-input shadow-xs',
  'text-sm text-ink-primary placeholder:text-ink-muted',
  'transition-[border-color,box-shadow] duration-200',
  'hover:border-ink-muted/50',
  'focus:outline-none focus-visible:border-brand-primary/70 focus-visible:ring-4 focus-visible:ring-brand-primary/15',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

/** Campo de una línea: alto y relleno estándar. */
export const fieldInputClassName = cn(fieldClassName, 'h-10 px-3 py-2.5')

/** Selector nativo (sin flecha propia). */
export const fieldSelectClassName = cn(fieldClassName, 'h-10 cursor-pointer px-3 py-2')

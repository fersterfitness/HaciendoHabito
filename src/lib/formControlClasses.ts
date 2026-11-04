import { cn } from '@/lib/utils'

/**
 * Estilo único de campos sueltos (select / input nativos fuera de <Input> / <Select>).
 * Mismo borde, fondo, sombra y foco que los componentes de formulario.
 */
export const controlBaseClassName = cn(
  'rounded-xl border border-surface-inputBorder bg-surface-input text-ink-primary shadow-xs',
  'placeholder:text-ink-muted transition-[border-color,box-shadow] duration-200',
  'hover:border-ink-muted/50',
  'focus:outline-none focus-visible:border-brand-primary/70 focus-visible:ring-4 focus-visible:ring-brand-primary/15',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

/** Alto estándar (formularios). */
export const controlMdClassName = cn(controlBaseClassName, 'h-10 px-3 text-sm')

/** Compacto (filtros, editores densos). */
export const controlSmClassName = cn(controlBaseClassName, 'h-8 px-2.5 text-xs')

/** Campo de una línea a lo ancho (lo usa `Input` y cualquier input nativo de formulario). */
export const controlInputClassName = cn('w-full', controlMdClassName)

/** Selector nativo a lo ancho. */
export const controlSelectClassName = cn('w-full cursor-pointer', controlMdClassName)

/** Área de texto: mismo borde y foco, alto libre. */
export const controlTextareaClassName = cn('w-full px-3 py-2 text-sm', controlBaseClassName)

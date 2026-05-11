import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Luna sólida (modo claro activo): sin acento de marca, negro sobre fondo claro. */
export function ThemeToggleMoonIcon({ className }: { className?: string }) {
  return (
    <Moon
      className={cn('h-4 w-4 shrink-0 text-ink-primary', className)}
      fill="currentColor"
      stroke="none"
      strokeWidth={0}
      aria-hidden
    />
  )
}

/** Sol con centro relleno (modo oscuro activo): blanco, sin acento naranja. */
export function ThemeToggleSunIcon({ className }: { className?: string }) {
  return (
    <Sun
      className={cn(
        'h-4 w-4 shrink-0 text-white [&>circle]:fill-current [&>circle]:stroke-none [&>path]:stroke-current',
        className,
      )}
      fill="none"
      strokeWidth={1.75}
      aria-hidden
    />
  )
}

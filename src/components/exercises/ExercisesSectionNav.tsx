import { NavLink } from 'react-router-dom'
import { BookOpen, Layers, Boxes, Library } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/exercises', label: 'Catálogo', icon: BookOpen, end: true },
  { to: '/exercises/methods', label: 'Métodos', icon: Layers, end: false },
  { to: '/exercises/presets', label: 'Circuitos', icon: Boxes, end: false },
  { to: '/exercises/blueprints', label: 'Rutinas preestablecidas', icon: Library, end: false },
] as const

export function ExercisesSectionNav() {
  return (
    <nav
      className="flex gap-1 rounded-xl border border-surface-border bg-surface-elevated/40 p-1 w-full max-w-2xl"
      aria-label="Sección base de datos"
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex flex-1 min-h-9 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors sm:text-xs sm:px-3',
              isActive
                ? 'border-brand-secondary/35 bg-brand-secondary/10 text-ink-primary shadow-sm'
                : 'border-transparent text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

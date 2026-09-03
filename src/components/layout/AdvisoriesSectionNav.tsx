import { NavLink } from 'react-router-dom'
import { Dumbbell, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { canSeeTraining } from '@/config/navigation'

const tabs = [
  { to: '/students', label: 'Alumnos', icon: Users, end: false },
  { to: '/routines', label: 'Rutinas', icon: Dumbbell, end: false },
] as const

export function AdvisoriesSectionNav() {
  const role = useAuthStore((s) => s.profile?.role)
  if (!canSeeTraining(role)) return null

  return (
    <nav
      className="mb-4 flex w-full max-w-md gap-1 rounded-xl border border-surface-border bg-surface-elevated/40 p-1"
      aria-label="Asesorías"
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
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

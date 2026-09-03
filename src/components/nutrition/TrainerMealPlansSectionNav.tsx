import { NavLink } from 'react-router-dom'
import { Apple, ClipboardList, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { NAV_TRAINER_MEAL_PLAN_TABS } from '@/config/navigation'

const ICONS = {
  '/meal-plans': UtensilsCrossed,
  '/nutrition/planning': ClipboardList,
  '/nutrition/foods': Apple,
} as const

export function TrainerMealPlansSectionNav() {
  const role = useAuthStore((s) => s.profile?.role)
  if (role !== 'trainer' && role !== 'admin') return null

  return (
    <nav
      className="mb-4 flex w-full max-w-2xl gap-1 rounded-xl border border-surface-border bg-surface-elevated/40 p-1"
      aria-label="Planes de alimentación"
    >
      {NAV_TRAINER_MEAL_PLAN_TABS.map(({ href, label }) => {
        const Icon = ICONS[href]
        return (
          <NavLink
            key={href}
            to={href}
            end={href === '/meal-plans'}
            className={({ isActive }) =>
              cn(
                'flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors sm:text-xs sm:px-3',
                isActive
                  ? 'border-brand-secondary/35 bg-brand-secondary/10 text-ink-primary shadow-sm'
                  : 'border-transparent text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            {label}
          </NavLink>
        )
      })}
    </nav>
  )
}

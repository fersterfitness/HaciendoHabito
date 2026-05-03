import { NavLink, useLocation } from 'react-router-dom'
import { Home, Users, Dumbbell, Wallet, MessageSquare, Salad, CalendarClock, Apple, ClipboardList, UtensilsCrossed } from 'lucide-react'

const studentNavItems = [
  { label: 'Inicio', href: '/dashboard', icon: Home },
  { label: 'Mi plan', href: '/my/meal-plans', icon: ClipboardList },
  { label: 'Turnos', href: '/appointments', icon: CalendarClock },
]
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

const trainerNavItems = [
  { label: 'Inicio',    href: '/dashboard', icon: Home },
  { label: 'Turnos',   href: '/appointments', icon: CalendarClock },
  { label: 'Alumnos',  href: '/students',  icon: Users },
  { label: 'Rutinas',  href: '/routines',  icon: Dumbbell },
  { label: 'Planes', href: '/meal-plans', icon: UtensilsCrossed },
  { label: 'Armar plan', href: '/nutrition/planning', icon: ClipboardList },
  { label: 'Alimentos', href: '/nutrition/foods', icon: Apple },
  { label: 'Finanzas', href: '/finances',  icon: Wallet },
  { label: 'Dudas',    href: '/feedback',  icon: MessageSquare },
]

const nutritionistNavItems = [
  { label: 'Inicio', href: '/dashboard', icon: Home },
  { label: 'Turnos', href: '/appointments', icon: CalendarClock },
  { label: 'Nutrición', href: '/nutrition', icon: Salad },
  { label: 'Armar plan', href: '/nutrition/planning', icon: ClipboardList },
  { label: 'Pacientes', href: '/students', icon: Users },
]

const adminNavItems = [
  { label: 'Inicio', href: '/dashboard', icon: Home },
  { label: 'Turnos', href: '/appointments', icon: CalendarClock },
  { label: 'Alumnos', href: '/students', icon: Users },
  { label: 'Rutinas', href: '/routines', icon: Dumbbell },
  { label: 'Planes', href: '/meal-plans', icon: UtensilsCrossed },
  { label: 'Nutrición', href: '/nutrition', icon: Salad },
  { label: 'Armar plan', href: '/nutrition/planning', icon: ClipboardList },
  { label: 'Finanzas', href: '/finances', icon: Wallet },
]

function isMobileItemActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileNav() {
  const { pathname } = useLocation()
  const role = useAuthStore((state) => state.profile?.role)
  const mobileNavItems =
    role === 'student'
      ? studentNavItems
      : role === 'admin'
        ? adminNavItems
        : role === 'nutritionist'
          ? nutritionistNavItems
          : trainerNavItems

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-surface-border print:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-150',
                  isActive ? 'text-brand-primary' : 'text-ink-muted hover:text-ink-secondary'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn('p-1.5 rounded-lg transition-colors', (isActive || isMobileItemActive(pathname, item.href)) ? 'bg-brand-primary/10' : '')}>
                    <Icon className={cn('h-4 w-4', (isActive || isMobileItemActive(pathname, item.href)) && 'text-brand-primary')} />
                  </div>
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

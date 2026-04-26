import { NavLink } from 'react-router-dom'
import { Home, Users, Dumbbell, FileText, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const mobileNavItems = [
  { label: 'Inicio', href: '/dashboard', icon: Home },
  { label: 'Alumnos', href: '/students', icon: Users },
  { label: 'Rutinas', href: '/routines', icon: Dumbbell },
  { label: 'PDFs', href: '/routine-pdfs', icon: FileText },
  { label: 'Dudas', href: '/feedback', icon: MessageSquare },
]

export function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-surface-border px-2 pb-safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors',
                  isActive ? 'text-brand-primary' : 'text-ink-muted'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-5 w-5', isActive && 'text-brand-primary')} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

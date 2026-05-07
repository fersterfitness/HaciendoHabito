import { Fragment } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { getMobileNavItems } from '@/config/navigation'

function isMobileItemActive(pathname: string, href: string) {
  const home = pathname === '/' || pathname === '/dashboard'
  if (href === '/dashboard') return home
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileNav() {
  const { pathname } = useLocation()
  const role = useAuthStore((state) => state.profile?.role)
  const mobileNavItems = getMobileNavItems(role)

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-surface-border print:hidden">
      <div className="flex items-center justify-around h-16 px-1 overflow-x-auto scrollbar-hide">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const to = item.href
          return (
            <NavLink
              key={item.href + item.label}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-150 shrink-0 min-w-[56px]',
                  isActive ? 'text-brand-primary' : 'text-ink-muted hover:text-ink-secondary',
                )
              }
            >
              {({ isActive }) => (
                <Fragment>
                  <div
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      (isActive || isMobileItemActive(pathname, to)) && 'bg-brand-primary/10',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        (isActive || isMobileItemActive(pathname, to)) && 'text-brand-primary',
                      )}
                    />
                  </div>
                  <span className="text-[10px] font-medium leading-none text-center max-w-[4.5rem] truncate">
                    {item.label}
                  </span>
                </Fragment>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

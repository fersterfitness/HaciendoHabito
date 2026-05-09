import { Fragment, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { trainerCtaAccentTextClassName, trainerCtaTintBgClassName } from '@/lib/primaryGradientCtaClasses'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { getMobileNavItems } from '@/config/navigation'
import { Settings, LogOut, X, MoreHorizontal, UserCircle, type LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { AvatarOrInitials } from '@/components/account/AvatarOrInitials'
import type { AppRole } from '@/types/database'

const MAX_PRIMARY = 4 // items shown directly in the bar (+ Más button)

function isMobileItemActive(pathname: string, href: string) {
  const home = pathname === '/' || pathname === '/dashboard'
  if (href === '/dashboard') return home
  return pathname === href || pathname.startsWith(`${href}/`)
}

function roleLabel(role: AppRole | undefined) {
  if (role === 'nutritionist') return 'Nutricionista'
  if (role === 'trainer') return 'Entrenador'
  if (role === 'admin') return 'Admin'
  if (role === 'student') return 'Alumno'
  return 'Sin perfil'
}

function DrawerNavItem({
  to,
  label,
  icon: Icon,
  onClose,
}: {
  to: string
  label: string
  icon: LucideIcon
  onClose: () => void
}) {
  const { pathname } = useLocation()
  const active = isMobileItemActive(pathname, to)
  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
        active
          ? cn(trainerCtaTintBgClassName, trainerCtaAccentTextClassName)
          : 'text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active && trainerCtaAccentTextClassName)} />
      {label}
    </NavLink>
  )
}

export function MobileNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile, reset } = useAuthStore()
  const role = profile?.role
  const allItems = getMobileNavItems(role)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const reduceMotion = useReducedMotion()

  const primaryItems = allItems.slice(0, MAX_PRIMARY)
  const drawerItems = allItems.slice(MAX_PRIMARY)

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  async function handleLogout() {
    setDrawerOpen(false)
    await supabase.auth.signOut()
    reset()
    navigate('/login')
    toast.success('Sesión cerrada')
  }

  return (
    <>
      {/* Bottom bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-surface-border print:hidden">
        <div className="flex items-center justify-around h-16 px-1">
          {primaryItems.map((item) => {
            const Icon = item.icon
            const to = item.href
            const active = isMobileItemActive(pathname, to)
            return (
              <NavLink
                key={item.href + item.label}
                to={to}
                className={cn(
                  'flex flex-col items-center gap-1 px-2 py-2 rounded-xl shrink-0 min-w-[56px]',
                  'transition-[color,transform] duration-200 ease-out motion-safe:active:scale-95',
                  active ? trainerCtaAccentTextClassName : 'text-ink-muted hover:text-ink-secondary',
                )}
              >
                <div className={cn('p-1.5 rounded-lg transition-colors', active && trainerCtaTintBgClassName)}>
                  <Icon className={cn('h-4 w-4', active && trainerCtaAccentTextClassName)} />
                </div>
                <span className="text-[10px] font-medium leading-none text-center max-w-[4.5rem] truncate">
                  {item.label}
                </span>
              </NavLink>
            )
          })}

          {/* Más button */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-2 rounded-xl shrink-0 min-w-[56px]',
              'transition-[color,transform] duration-200 ease-out motion-safe:active:scale-95',
              drawerOpen ? trainerCtaAccentTextClassName : 'text-ink-muted hover:text-ink-secondary',
            )}
          >
            <div className={cn('p-1.5 rounded-lg transition-colors', drawerOpen && trainerCtaTintBgClassName)}>
              <MoreHorizontal className={cn('h-4 w-4', drawerOpen && trainerCtaAccentTextClassName)} />
            </div>
            <span className="text-[10px] font-medium leading-none">Más</span>
          </button>
        </div>
      </nav>

      {/* Drawer overlay + sheet (entrada/salida animada; respeta prefers-reduced-motion) */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="mobile-more-drawer"
            className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end print:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              aria-hidden
              onClick={() => setDrawerOpen(false)}
            />

            <motion.div
              className="relative z-10 rounded-t-3xl bg-surface-card border-t border-surface-border shadow-2xl max-h-[85dvh] flex flex-col overflow-hidden"
              initial={reduceMotion ? false : { y: '100%' }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0.15 }
                  : { duration: 0.34, ease: [0.16, 1, 0.3, 1] }
              }
            >
            {/* Handle + header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-border/60 shrink-0">
              <div className="flex items-center gap-3">
                <AvatarOrInitials
                  fullName={profile?.full_name ?? '?'}
                  avatarUrl={profile?.avatar_url}
                  size="sm"
                  rounded="xl"
                  className="!font-bold shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-ink-primary leading-tight">{profile?.full_name ?? '—'}</p>
                  <p className="text-xs text-ink-muted">{roleLabel(role)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl p-2 text-ink-muted hover:bg-surface-elevated hover:text-ink-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable nav list */}
            <div className="overflow-y-auto flex-1 px-3 py-3 space-y-0.5">
              {drawerItems.length > 0 && (
                <Fragment>
                  <p className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                    Navegación
                  </p>
                  {drawerItems.map((item) => (
                    <DrawerNavItem
                      key={item.href + item.label}
                      to={item.href}
                      label={item.label}
                      icon={item.icon}
                      onClose={() => setDrawerOpen(false)}
                    />
                  ))}
                </Fragment>
              )}

              {/* Settings + Profile always visible */}
              <div className="mt-2 border-t border-surface-border/60 pt-2 space-y-0.5">
                <p className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                  Cuenta
                </p>
                <DrawerNavItem
                  to="/settings"
                  label="Configuración"
                  icon={Settings}
                  onClose={() => setDrawerOpen(false)}
                />
                <DrawerNavItem
                  to="/profile"
                  label="Mi perfil"
                  icon={UserCircle}
                  onClose={() => setDrawerOpen(false)}
                />
              </div>
            </div>

            {/* Logout */}
            <div className="shrink-0 px-3 pb-6 pt-2 border-t border-surface-border/60">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-status-expired hover:bg-status-expired/10 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Cerrar sesión
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

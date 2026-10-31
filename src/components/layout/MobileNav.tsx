import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
import {
  getMobileNavDrawerSections,
  getMobileNavPrimaryItems,
  getMobileQuickActions,
  isNavPathActive,
  navItemKey,
  type NavItem,
} from '@/config/navigation'
import { prefetchRouteChunkByHref } from '@/lib/prefetchRouteChunks'
import { ChevronRight, LogOut, Menu, Moon, Plus, Settings, Sun, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { AvatarOrInitials } from '@/components/account/AvatarOrInitials'
import type { AppRole } from '@/types/database'

function roleLabel(role: AppRole | undefined) {
  if (role === 'nutritionist') return 'Nutricionista'
  if (role === 'psychologist') return 'Psicólogo'
  if (role === 'trainer') return 'Entrenador'
  if (role === 'admin') return 'Admin'
  if (role === 'student') return 'Alumno'
  return 'Sin perfil'
}

/** Hoja que sube desde abajo (celu). Respeta prefers-reduced-motion. */
function BottomSheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key={label}
          className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden print:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" aria-hidden onClick={onClose} />
          <motion.div
            className="relative z-10 flex max-h-[88dvh] min-h-0 flex-col overflow-hidden rounded-t-[1.75rem] border-t border-surface-border bg-surface-card pb-[env(safe-area-inset-bottom)] shadow-pop"
            initial={reduceMotion ? false : { y: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reduceMotion ? { duration: 0.15 } : { duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink-muted/30" />
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

const barItemClass = (active: boolean) =>
  cn(
    'flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5',
    'transition-[color,transform] duration-200 ease-out motion-safe:active:scale-95',
    appFocusRingClassName,
    active ? 'text-ink-primary' : 'text-ink-muted hover:text-ink-secondary',
  )

/** Pastilla del ícono: se pinta con el color de marca cuando la sección está activa. */
function BarIcon({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
        active && 'bg-brand-primary/12 text-brand-primary dark:bg-brand-primary/18',
      )}
    >
      {children}
    </span>
  )
}

function BarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.href}
      onMouseEnter={() => prefetchRouteChunkByHref(item.href)}
      onFocus={() => prefetchRouteChunkByHref(item.href)}
      aria-current={active ? 'page' : undefined}
      className={barItemClass(active)}
    >
      <BarIcon active={active}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.3 : 1.9} />
      </BarIcon>
      <span className={cn('max-w-full truncate text-3xs leading-none', active ? 'font-semibold' : 'font-medium')} title={item.label}>
        {item.shortLabel ?? item.label}
      </span>
    </NavLink>
  )
}

/** Mosaico del menú «Más»: ícono en un cuadro + nombre, en grilla. */
function DrawerTile({ item, active, onClose }: { item: NavItem; active: boolean; onClose: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.href}
      onClick={onClose}
      onMouseEnter={() => prefetchRouteChunkByHref(item.href)}
      onFocus={() => prefetchRouteChunkByHref(item.href)}
      className={cn(
        'flex min-h-[5.5rem] flex-col items-start justify-between gap-2.5 rounded-2xl border p-3 transition-colors',
        appFocusRingClassName,
        active
          ? 'border-brand-primary/35 bg-brand-primary/[0.07]'
          : 'border-surface-border/80 bg-surface-elevated/40 hover:bg-surface-elevated',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl',
          active ? 'bg-brand-primary text-white' : 'bg-surface-card text-ink-secondary shadow-xs ring-1 ring-inset ring-surface-border/70',
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="text-xs font-semibold leading-tight text-ink-primary">{item.label}</span>
    </NavLink>
  )
}

export function MobileNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile, reset } = useAuthStore()
  const { theme, toggleTheme } = useTheme()
  const role = profile?.role
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const primaryItems = getMobileNavPrimaryItems(role)
  const drawerSections = getMobileNavDrawerSections(role)
  const quickActions = getMobileQuickActions(role)
  const sectionRank = (title: string) => (title === 'Gestión' ? 0 : title === 'Finanzas' ? 1 : 2)
  const drawerItems = [...drawerSections]
    .sort((a, b) => sectionRank(a.title) - sectionRank(b.title))
    .flatMap((section) => section.items)
  const drawerRouteActive = drawerSections.some((section) =>
    section.items.some((item) => isNavPathActive(pathname, item)),
  )
  const moreActive = drawerOpen || drawerRouteActive

  // Cerrar las hojas al cambiar de ruta
  useEffect(() => {
    setDrawerOpen(false)
    setCreateOpen(false)
  }, [pathname])

  // Sin scroll de fondo con una hoja abierta
  useEffect(() => {
    document.body.style.overflow = drawerOpen || createOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen, createOpen])

  async function handleLogout() {
    setDrawerOpen(false)
    await supabase.auth.signOut()
    reset()
    navigate('/login')
    // Abajo para no tapar el acceso superior (p. ej. «Panel» / inscripción) en /login o /form.
    toast.success('Sesión cerrada', { position: 'bottom-center' })
  }

  const moreButton = (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={drawerOpen}
      className={barItemClass(moreActive)}
    >
      <BarIcon active={moreActive}>
        <Menu className="h-[18px] w-[18px]" />
      </BarIcon>
      <span className={cn('text-3xs leading-none', moreActive ? 'font-semibold' : 'font-medium')}>Más</span>
    </button>
  )

  const items = primaryItems.map((item) => (
    <BarItem key={navItemKey(item)} item={item} active={isNavPathActive(pathname, item)} />
  ))
  // Con «+», queda en el centro: la mitad de los accesos a cada lado (contando «Más»).
  const leftCount = Math.ceil((items.length + 1) / 2)

  return (
    <>
      {/* Barra inferior */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-surface-border/70 bg-surface-card/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-18px_rgb(0_0_0/0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-surface-card/80 lg:hidden print:hidden"
      >
        <div className="mx-auto flex h-16 max-w-xl items-center gap-1 px-2">
          {quickActions.length > 0 ? (
            <>
              {items.slice(0, leftCount)}
              <div className="flex flex-1 justify-center">
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  aria-label="Crear o registrar"
                  aria-haspopup="dialog"
                  aria-expanded={createOpen}
                  className={cn(
                    'hh-cta -mt-7 flex h-14 w-14 items-center justify-center rounded-2xl text-white ring-4 ring-surface-base',
                    'transition-transform duration-200 motion-safe:active:scale-95',
                    appFocusRingClassName,
                  )}
                >
                  <Plus className={cn('h-6 w-6 transition-transform duration-300', createOpen && 'rotate-45')} strokeWidth={2.4} />
                </button>
              </div>
              {items.slice(leftCount)}
              {moreButton}
            </>
          ) : (
            <>
              {items}
              {moreButton}
            </>
          )}
        </div>
      </nav>

      {/* «+»: crear o registrar */}
      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} label="Crear o registrar">
        <div className="flex items-center justify-between px-5 pb-1 pt-3">
          <div>
            <p className="text-base font-semibold tracking-tight text-ink-primary">¿Qué querés hacer?</p>
            <p className="text-2xs text-ink-muted">Lo de todos los días, a un toque</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(false)}
            className="rounded-xl p-2 text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 overflow-y-auto px-4 pb-6 pt-3">
          {quickActions.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.href}
                type="button"
                onClick={() => {
                  setCreateOpen(false)
                  navigate(a.href)
                }}
                onMouseEnter={() => prefetchRouteChunkByHref(a.href)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border border-surface-border/80 bg-surface-elevated/40 p-3 text-left transition-colors hover:bg-surface-elevated motion-safe:active:scale-[0.98]',
                  appFocusRingClassName,
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/12 text-brand-primary dark:bg-brand-primary/18">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-tight text-ink-primary">{a.label}</span>
                  <span className="mt-0.5 block truncate text-3xs text-ink-muted">{a.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </BottomSheet>

      {/* «Más»: el resto de las secciones en grilla + cuenta */}
      <BottomSheet open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Más secciones">
        <div className="flex items-center gap-3 px-5 pb-3 pt-3">
          <AvatarOrInitials
            fullName={profile?.full_name ?? '?'}
            avatarUrl={profile?.avatar_url}
            size="md"
            rounded="xl"
            className="shrink-0 !font-bold"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-ink-primary">{profile?.full_name ?? '—'}</p>
            <p className="text-xs text-ink-muted">{roleLabel(role)}</p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-xl p-2 text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
          {/* Una sola grilla: por sección quedaban filas de 1 o 2 mosaicos. Gestión y Finanzas primero. */}
          <section aria-label="Secciones">
            <p className="px-1 pb-2 text-3xs font-semibold uppercase tracking-widest text-ink-muted">Secciones</p>
            <div className="grid grid-cols-3 gap-2">
              {drawerItems.map((item) => (
                <DrawerTile
                  key={navItemKey(item)}
                  item={item}
                  active={isNavPathActive(pathname, item)}
                  onClose={() => setDrawerOpen(false)}
                />
              ))}
            </div>
          </section>

          <section aria-label="Cuenta" className="overflow-hidden rounded-2xl border border-surface-border/80">
            <NavLink
              to="/settings"
              onClick={() => setDrawerOpen(false)}
              className={cn('flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink-primary transition-colors hover:bg-surface-elevated', appFocusRingClassName)}
            >
              <Settings className="h-4 w-4 text-ink-muted" />
              <span className="flex-1">Perfil y configuración</span>
              <ChevronRight className="h-4 w-4 text-ink-muted" />
            </NavLink>
            <button
              type="button"
              onClick={toggleTheme}
              className={cn('flex w-full items-center gap-3 border-t border-surface-border/70 px-4 py-3 text-left text-sm font-medium text-ink-primary transition-colors hover:bg-surface-elevated', appFocusRingClassName)}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-ink-muted" /> : <Moon className="h-4 w-4 text-ink-muted" />}
              <span className="flex-1">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className={cn('flex w-full items-center gap-3 border-t border-surface-border/70 px-4 py-3 text-left text-sm font-medium text-status-expired transition-colors hover:bg-status-expired/10', appFocusRingClassName)}
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </section>
        </div>
      </BottomSheet>
    </>
  )
}

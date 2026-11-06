import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NotificationBellBadge } from '@/components/notifications/NotificationBellBadge'
import { motion, useReducedMotion } from 'motion/react'
import { flushSync } from 'react-dom'
import toast from 'react-hot-toast'
import {
  Bell,
  ChevronRight,
  LogOut,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sun,
  Undo2,
  Keyboard,
} from 'lucide-react'
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount'
import { AvatarOrInitials } from '@/components/account/AvatarOrInitials'
import { Popover } from '@/components/ui/Popover'
import { canSeeTraining, getNavV2, isNavPathActive, type NavItem } from '@/config/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { openGlobalSearch } from '@/lib/globalSearch'
import { openShortcutsHelp } from '@/lib/shortcutsV2'
import { prefetchRouteChunkByHref } from '@/lib/prefetchRouteChunks'
import { supabase } from '@/lib/supabase'
import { leaveV2 } from '@/lib/uiVersion'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import type { AppRole } from '@/types/database'

const ROLE_LABEL: Partial<Record<AppRole, string>> = {
  admin: 'Administración',
  trainer: 'Entrenador',
  nutritionist: 'Nutricionista',
  psychologist: 'Psicología',
  student: 'Alumno',
}

const COLLAPSE_KEY = 'hh-v2-sidebar-collapsed'
const MORE_KEY = 'hh-v2-sidebar-more'

/**
 * Cambia el tema con un revelado circular que sale del botón (View Transitions). Donde el
 * navegador no lo soporta, o con "reducir movimiento", cambia de golpe como siempre.
 */
function toggleThemeWithReveal(e: { clientX: number; clientY: number }, toggle: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    toggle()
    return
  }
  const root = document.documentElement
  root.style.setProperty('--v2-reveal-x', `${e.clientX}px`)
  root.style.setProperty('--v2-reveal-y', `${e.clientY}px`)
  doc.startViewTransition(() => flushSync(toggle))
}

/** Fondo del ítem al pasar: tinte sobre el lienzo (el gris de las tarjetas casi no se ve sobre él). */
const NAV_HOVER = 'hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'

const rowClass = (active: boolean) =>
  cn(
    'group relative isolate flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150',
    active ? 'font-medium text-ink-primary' : cn('text-ink-secondary hover:text-ink-primary', NAV_HOVER),
  )

const railBtnClass = (active = false) =>
  cn(
    'relative isolate flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150',
    active ? 'text-ink-primary' : cn('text-ink-muted hover:text-ink-primary', NAV_HOVER),
  )

/**
 * Pastilla del ítem activo: blanca con borde fino en claro, gris claro en oscuro. Usa el mismo
 * `layoutId` en todos los ítems, así al navegar se desliza de uno a otro (solo transform).
 */
function ActivePill({ id, rounded = 'rounded-lg' }: { id: string; rounded?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      layoutId={reduce ? undefined : id}
      aria-hidden
      className={cn('v2-nav-pill absolute inset-0 -z-10', rounded)}
      transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.7 }}
    />
  )
}

/** Marca de la v2: el mismo dibujo del logo, en negro liso. */
function BrandMarkV2({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="113 188 374 380" className={cn('shrink-0', className)} aria-hidden>
      <rect x="113" y="188" width="374" height="380" rx="84" className="fill-ink-primary" />
      <path d="M188 325 262 248V368H300L188 498Z M412 248V425L340 498V368H300Z" className="fill-surface-base" />
    </svg>
  )
}

/** Una entrada del menú en el panel. */
function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.href}
      className={rowClass(active)}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => prefetchRouteChunkByHref(item.href)}
    >
      {active ? <ActivePill id="v2-nav-pill" /> : null}
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-ink-primary' : 'text-ink-muted group-hover:text-ink-secondary')} strokeWidth={1.6} />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}

/**
 * Barra lateral de la v2 en dos columnas: un riel de acciones (marca, buscar, crear, cuenta) y un
 * panel con una sola lista corta (lo del día a día) y el resto dentro de «Más».
 * El panel se puede plegar: queda solo el riel con los íconos.
 */
export function SidebarV2() {
  const { profile, reset } = useAuthStore()
  const role = profile?.role
  const { pathname } = useLocation()
  const navigate = useAppNavigate()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const nav = getNavV2(role)
  const unread = useUnreadNotificationCount()
  const training = canSeeTraining(role)
  const moreHasActive = nav.more.some((i) => isNavPathActive(pathname, i))
  const [moreOpen, setMoreOpen] = useState(() => {
    try {
      return localStorage.getItem(MORE_KEY) === '1'
    } catch {
      return false
    }
  })
  const showMore = moreOpen || moreHasActive
  function toggleMore() {
    const next = !showMore
    setMoreOpen(next)
    try {
      localStorage.setItem(MORE_KEY, next ? '1' : '0')
    } catch {
      /* nada */
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* sin almacenamiento: queda en memoria */
    }
  }, [collapsed])

  // «/» abre la búsqueda (salvo que se esté escribiendo en un campo).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      openGlobalSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function logout() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    reset()
    navigate('/login')
    toast.success('Sesión cerrada', { position: 'bottom-center' })
  }

  const newStudent = () => navigate('/students?create=1')
  const allItems = [...nav.main, ...nav.more]

  return (
    <aside className="sticky top-0 hidden h-screen shrink-0 lg:flex print:hidden" aria-label="Navegación principal">
      {/* Riel */}
      <div className="flex w-14 flex-col items-center gap-1 py-3">
        <NavLink to="/dashboard" className="mb-3 flex h-9 w-9 items-center justify-center" title="Inicio" aria-label="Inicio">
          <BrandMarkV2 />
        </NavLink>
        <button type="button" onClick={() => setCollapsed((c) => !c)} className={railBtnClass()} title={collapsed ? 'Mostrar panel' : 'Ocultar panel'} aria-label={collapsed ? 'Mostrar panel' : 'Ocultar panel'}>
          <PanelLeft className="h-[17px] w-[17px]" strokeWidth={1.6} />
        </button>
        <button type="button" onClick={() => openGlobalSearch()} className={railBtnClass()} title="Buscar ( / )" aria-label="Buscar">
          <Search className="h-[17px] w-[17px]" strokeWidth={1.6} />
        </button>
        {training ? (
          <button type="button" onClick={newStudent} className={railBtnClass()} title="Nuevo alumno" aria-label="Nuevo alumno">
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </button>
        ) : null}

        {collapsed ? (
          <>
            <div className="my-2 h-px w-6 bg-surface-border" />
            {allItems.map((item) => {
              const Icon = item.icon
              const active = isNavPathActive(pathname, item)
              return (
                <NavLink
                  key={`${item.href}-${item.label}`}
                  to={item.href}
                  className={railBtnClass(active)}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  onMouseEnter={() => prefetchRouteChunkByHref(item.href)}
                >
                  {active ? <ActivePill id="v2-rail-pill" rounded="rounded-xl" /> : null}
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.6} />
                </NavLink>
              )
            })}
          </>
        ) : null}

        <div className="mt-auto flex flex-col items-center gap-1">
          <NavLink
            to="/notifications"
            className={({ isActive }) => railBtnClass(isActive)}
            title="Notificaciones"
            aria-label={unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
          >
            {({ isActive }) => (
              <>
                {isActive ? <ActivePill id="v2-rail-pill" rounded="rounded-xl" /> : null}
                <Bell className="h-[17px] w-[17px]" strokeWidth={1.6} />
                <NotificationBellBadge count={unread} className="right-0.5 top-0.5 scale-90" />
              </>
            )}
          </NavLink>
          <button type="button" onClick={(e) => toggleThemeWithReveal(e, toggleTheme)} className={railBtnClass()} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
            {theme === 'dark' ? <Sun className="h-[17px] w-[17px]" strokeWidth={1.6} /> : <Moon className="h-[17px] w-[17px]" strokeWidth={1.6} />}
          </button>
          <Popover
            open={menuOpen}
            onOpenChange={setMenuOpen}
            side="right"
            align="end"
            className="w-56 p-1"
            trigger={(t) => (
              <button {...t} type="button" className="mt-1 rounded-full" title="Cuenta" aria-label="Cuenta">
                <AvatarOrInitials fullName={profile?.full_name ?? '?'} avatarUrl={profile?.avatar_url ?? null} size="sm" />
              </button>
            )}
          >
            <div className="px-2 pb-1.5 pt-1">
              <p className="truncate text-[13px] font-medium text-ink-primary">{profile?.full_name ?? 'Mi cuenta'}</p>
              <p className="truncate text-[11px] text-ink-muted">{(role && ROLE_LABEL[role]) || 'Cuenta'}</p>
            </div>
            <div className="my-1 h-px bg-surface-border" />
            <MenuButton
              icon={Settings}
              onClick={() => {
                setMenuOpen(false)
                navigate('/settings')
              }}
            >
              Configuración
            </MenuButton>
            <MenuButton
              icon={Keyboard}
              onClick={() => {
                setMenuOpen(false)
                openShortcutsHelp()
              }}
            >
              Atajos de teclado
            </MenuButton>
            <MenuButton icon={Undo2} onClick={leaveV2}>
              Volver a la versión actual
            </MenuButton>
            <MenuButton icon={LogOut} onClick={() => void logout()}>
              Cerrar sesión
            </MenuButton>
          </Popover>
        </div>
      </div>

      {/* Panel */}
      {!collapsed ? (
        // Tarjeta propia (como el panel del contenido) para que no se funda con el riel.
        <div className="my-2.5 mr-2.5 flex w-[13.5rem] flex-col rounded-[1.25rem] bg-[rgb(var(--v2-sidebar-panel))] px-2 py-2.5 shadow-[0_0_0_1px_rgb(0_0_0/0.05)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
          <div className="mb-2 flex h-9 items-center px-2.5">
            <span className="truncate text-[14px] font-medium tracking-[-0.01em] text-ink-primary">Haciéndolo Hábito</span>
          </div>

          <nav className="-mr-1 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pr-1 scrollbar-hide">
            {nav.main.map((item) => (
              <NavRow key={`${item.href}-${item.label}`} item={item} active={isNavPathActive(pathname, item)} />
            ))}
            {nav.more.length ? (
              <>
                <button
                  type="button"
                  onClick={toggleMore}
                  aria-expanded={showMore}
                  className="group mt-3 flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-ink-muted transition-colors hover:text-ink-primary"
                >
                  Más
                  <ChevronRight className={cn('h-3 w-3 transition-transform duration-200', showMore && 'rotate-90')} aria-hidden />
                </button>
                {showMore
                  ? nav.more.map((item) => (
                      <NavRow key={`${item.href}-${item.label}`} item={item} active={isNavPathActive(pathname, item)} />
                    ))
                  : null}
              </>
            ) : null}
          </nav>
        </div>
      ) : null}
    </aside>
  )
}

function MenuButton({ icon: Icon, onClick, children }: { icon: typeof Settings; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-primary transition-colors hover:bg-surface-elevated"
    >
      <Icon className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
      {children}
    </button>
  )
}

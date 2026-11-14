import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NotificationBellBadge } from '@/components/notifications/NotificationBellBadge'
import { motion, useReducedMotion } from 'motion/react'
import { flushSync } from 'react-dom'
import toast from 'react-hot-toast'
import {
  Bell,
  ChevronsUpDown,
  LogOut,
  Moon,
  PanelLeft,
  Search,
  Settings,
  Sun,
  Undo2,
  Keyboard,
} from 'lucide-react'
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount'
import { AvatarOrInitials } from '@/components/account/AvatarOrInitials'
import { Popover } from '@/components/ui/Popover'
import { getNavV2, isNavPathActive, type NavItem } from '@/config/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { openGlobalSearch } from '@/lib/globalSearch'
import { openShortcutsHelp } from '@/lib/shortcutsV2'
import { prefetchRouteChunkByHref } from '@/lib/prefetchRouteChunks'
import { supabase } from '@/lib/supabase'
import { leaveV2 } from '@/lib/uiVersion'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useNavCounts, type NavCount } from '@/stores/navCounts'
import type { AppRole } from '@/types/database'

const ROLE_LABEL: Partial<Record<AppRole, string>> = {
  admin: 'Administración',
  trainer: 'Entrenador',
  nutritionist: 'Nutricionista',
  psychologist: 'Psicología',
  student: 'Alumno',
}

const COLLAPSE_KEY = 'hh-v2-sidebar-collapsed'

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

/** Marca de la v2: el logo del proyecto (naranja con la marca en negro), el mismo archivo que el ícono de la app. */
function BrandMarkV2({ className = 'h-7 w-7' }: { className?: string }) {
  return <img src="/app-icon.svg" alt="" aria-hidden className={cn('shrink-0', className)} />
}

/** Contador del día al lado de un ítem. */
function CountBadge({ count }: { count: NavCount }) {
  return (
    <span
      className={cn(
        'ml-auto shrink-0 rounded-md px-1.5 text-2xs font-medium leading-[18px] tabular-nums',
        count.tone === 'accent'
          ? 'bg-ink-primary text-surface-base dark:bg-status-ok dark:text-[rgb(36_53_11)]'
          : count.tone === 'alert'
            ? 'bg-status-expired/12 text-status-expired'
            : 'bg-black/[0.06] text-ink-secondary dark:bg-white/[0.08]',
      )}
    >
      {count.n > 99 ? '99+' : count.n}
    </span>
  )
}

/** Una entrada del menú: ícono, nombre y, si hay, el contador del día. La ayuda va al pasar el mouse. */
function NavRow({ item, active, count }: { item: NavItem; active: boolean; count?: NavCount }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.href}
      className={rowClass(active)}
      title={item.hint}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => prefetchRouteChunkByHref(item.href)}
    >
      {active ? <ActivePill id="v2-nav-pill" /> : null}
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-ink-primary' : 'text-ink-muted group-hover:text-ink-secondary')} strokeWidth={1.6} />
      <span className="truncate">{item.label}</span>
      {count ? <CountBadge count={count} /> : null}
    </NavLink>
  )
}

/**
 * Barra lateral de la v2 en una sola columna: marca, buscador, el menú con los contadores del día
 * y la cuenta al pie. Se puede plegar: queda un riel con los íconos.
 */
export function SidebarV2() {
  const { profile, reset } = useAuthStore()
  const role = profile?.role
  const { pathname } = useLocation()
  const navigate = useAppNavigate()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  // Sin elección guardada, en pantallas medianas (tablet en horizontal) arranca plegada: así la tabla y la ficha tienen lugar.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY)
      return saved == null ? window.innerWidth < 1280 : saved === '1'
    } catch {
      return false
    }
  })
  const nav = getNavV2(role)
  const unread = useUnreadNotificationCount()
  const counts = useNavCounts((st) => st.counts)

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

  const allItems = [...nav.main, ...nav.more]

  const accountMenu = (trigger: Parameters<typeof Popover>[0]['trigger']) => (
    <Popover open={menuOpen} onOpenChange={setMenuOpen} side="right" align="end" className="w-56 p-1" trigger={trigger}>
      <div className="px-2 pb-1.5 pt-1">
        <p className="truncate text-[13px] font-medium text-ink-primary">{profile?.full_name ?? 'Mi cuenta'}</p>
        <p className="truncate text-[11px] text-ink-muted">{(role && ROLE_LABEL[role]) || 'Cuenta'}</p>
      </div>
      <div className="my-1 h-px bg-surface-border" />
      <MenuButton
        icon={Bell}
        onClick={() => {
          setMenuOpen(false)
          navigate('/notifications')
        }}
      >
        Notificaciones{unread > 0 ? ` · ${unread}` : ''}
      </MenuButton>
      <MenuButton icon={theme === 'dark' ? Sun : Moon} onClick={(e) => toggleThemeWithReveal(e, toggleTheme)}>
        {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      </MenuButton>
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
      <div className="my-1 h-px bg-surface-border" />
      <MenuButton icon={LogOut} onClick={() => void logout()}>
        Cerrar sesión
      </MenuButton>
    </Popover>
  )
  const collapseLabel = collapsed ? 'Mostrar menú' : 'Plegar menú'

  if (collapsed) {
    return (
      <aside className="sticky top-0 hidden h-screen w-14 shrink-0 flex-col items-center gap-1 py-3 lg:flex print:hidden" aria-label="Navegación principal">
        <NavLink to="/dashboard" className="mb-2 flex h-9 w-9 items-center justify-center" title="Inicio" aria-label="Inicio">
          <BrandMarkV2 />
        </NavLink>
        <button type="button" onClick={() => setCollapsed(false)} className={railBtnClass()} title={collapseLabel} aria-label={collapseLabel} aria-expanded={false}>
          <PanelLeft className="h-[17px] w-[17px]" strokeWidth={1.6} />
        </button>
        <button type="button" onClick={() => openGlobalSearch()} className={railBtnClass()} title="Buscar ( / )" aria-label="Buscar">
          <Search className="h-[17px] w-[17px]" strokeWidth={1.6} />
        </button>
        <div className="my-2 h-px w-6 bg-surface-border" />
        {allItems.map((item) => {
          const Icon = item.icon
          const active = isNavPathActive(pathname, item)
          const count = counts[item.href]
          return (
            <NavLink
              key={`${item.href}-${item.label}`}
              to={item.href}
              className={railBtnClass(active)}
              title={`${item.label}${count ? ` · ${count.n}` : ''}`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              onMouseEnter={() => prefetchRouteChunkByHref(item.href)}
            >
              {active ? <ActivePill id="v2-rail-pill" rounded="rounded-xl" /> : null}
              <Icon className="h-[17px] w-[17px]" strokeWidth={1.6} />
              {count ? (
                <span className={cn('absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full', count.tone === 'alert' ? 'bg-status-expired' : count.tone === 'accent' ? 'bg-ink-primary dark:bg-status-ok' : 'bg-ink-muted')} aria-hidden />
              ) : null}
            </NavLink>
          )
        })}
        <div className="mt-auto">
          {accountMenu((t) => (
            <button {...t} type="button" className="relative rounded-full" title="Cuenta" aria-label="Cuenta">
              <AvatarOrInitials fullName={profile?.full_name ?? '?'} avatarUrl={profile?.avatar_url ?? null} size="sm" />
              <NotificationBellBadge count={unread} className="-right-0.5 -top-0.5 scale-90" />
            </button>
          ))}
        </div>
      </aside>
    )
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[14.5rem] shrink-0 flex-col px-2.5 py-3 lg:flex print:hidden" aria-label="Navegación principal">
      <div className="mb-3 flex h-9 items-center gap-2.5 pl-1.5">
        <NavLink to="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5" title="Inicio">
          <BrandMarkV2 className="h-6 w-6" />
          <span className="truncate text-[14px] font-medium tracking-[-0.01em] text-ink-primary">Haciéndolo Hábito</span>
        </NavLink>
        <button type="button" onClick={() => setCollapsed(true)} className={cn(railBtnClass(), 'h-8 w-8')} title={collapseLabel} aria-label={collapseLabel} aria-expanded>
          <PanelLeft className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => openGlobalSearch()}
        className="v2-nav-pill mb-3 flex h-8 items-center gap-2 rounded-lg px-2.5 text-left text-[13px] text-ink-muted transition-colors hover:text-ink-primary"
        aria-label="Buscar"
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        Buscar
        <kbd className="ml-auto rounded bg-black/[0.05] px-1.5 font-mono text-2xs leading-[18px] text-ink-muted dark:bg-white/[0.08]">/</kbd>
      </button>

      <nav className="-mr-1 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pr-1 scrollbar-hide">
        {nav.main.map((item) => (
          <NavRow key={`${item.href}-${item.label}`} item={item} active={isNavPathActive(pathname, item)} count={counts[item.href]} />
        ))}
        {nav.more.length ? (
          <>
            <p className="mb-1 mt-4 px-2.5 text-2xs font-medium text-ink-muted">Más</p>
            {nav.more.map((item) => (
              <NavRow key={`${item.href}-${item.label}`} item={item} active={isNavPathActive(pathname, item)} count={counts[item.href]} />
            ))}
          </>
        ) : null}
      </nav>

      <div className="mt-2">
        {accountMenu((t) => (
          <button
            {...t}
            type="button"
            className={cn('flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors', NAV_HOVER)}
            title="Cuenta"
          >
            <span className="relative shrink-0">
              <AvatarOrInitials fullName={profile?.full_name ?? '?'} avatarUrl={profile?.avatar_url ?? null} size="sm" />
              <NotificationBellBadge count={unread} className="-right-0.5 -top-0.5 scale-90" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium leading-tight text-ink-primary">{profile?.full_name ?? 'Mi cuenta'}</span>
              <span className="truncate text-2xs leading-tight text-ink-muted">{(role && ROLE_LABEL[role]) || 'Cuenta'}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
          </button>
        ))}
      </div>
    </aside>
  )
}

function MenuButton({ icon: Icon, onClick, children }: { icon: typeof Settings; onClick: (e: React.MouseEvent) => void; children: ReactNode }) {
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

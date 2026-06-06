import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { Settings, LogOut, type LucideIcon } from 'lucide-react'
import { SidebarAnimateIcon, SidebarLogOutIcon } from '@/components/icons/sidebarAnimateIcons'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'
import { getSidebarBlocks, type NavItem } from '@/config/navigation'
import type { AppRole } from '@/types/database'
import { prefetchRouteChunkByHref } from '@/lib/prefetchRouteChunks'

const RAIL_W = 'w-[52px]'
const RAIL_ITEM = 'size-[32px] rounded-lg'

/** Contenedor flotante: margen + sombra (el rail va dentro). */
const railShellClass = cn(
  'hidden lg:flex shrink-0 sticky top-0 z-30 h-screen flex-col py-3 pl-3 print:hidden',
)

const railPanelClass = cn(
  RAIL_W,
  'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl',
  'border border-surface-border/75 bg-[rgb(var(--surface-sidebar))]',
  'shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_8px_28px_-6px_rgba(0,0,0,0.1)]',
  'dark:border-white/[0.07]',
  'dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.45),0_12px_40px_-8px_rgba(0,0,0,0.65)]',
)

/** Pastilla activa: negro + ícono blanco en light; blanco + ícono oscuro en dark. */
const railActivePillClass = 'rounded-lg bg-zinc-900 shadow-sm dark:bg-zinc-100 dark:shadow-none'

const railNavActiveClassName = 'text-white dark:text-zinc-900'

/** Rebote suave tipo gelatina al cambiar de ítem. */
const railSpring = { type: 'spring' as const, stiffness: 360, damping: 26, mass: 0.82 }

const railFocusRing = cn(
  'focus-visible:ring-2 focus-visible:ring-brand-secondary/35 focus-visible:ring-offset-2',
  'focus-visible:ring-offset-[rgb(var(--surface-sidebar))]',
)

const railNavIdleClassName = cn(
  'text-zinc-500 hover:text-zinc-900',
  'dark:text-white/40 dark:hover:text-white/90',
)

/** Tooltip compacto alineado al acento secondary. */
function RailTooltipBubble({ label }: { label: string }) {
  return (
    <span
      className={cn(
        'inline-block max-w-[min(14rem,calc(100vw-4.5rem))] truncate rounded-md px-2.5 py-1',
        'border border-surface-border/90 bg-surface-card text-[11px] font-medium leading-snug tracking-tight text-ink-primary',
        'shadow-card-md',
        'dark:border-white/10 dark:bg-zinc-900/95 dark:text-white/90 dark:shadow-[0_6px_20px_rgba(0,0,0,0.4)]',
      )}
    >
      {label}
    </span>
  )
}

function SidebarRailTooltip({ label, children }: { label: string; children: ReactNode }) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const measure = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.top + r.height / 2, left: r.right + 8 })
  }, [])

  const show = useCallback(() => {
    requestAnimationFrame(() => {
      measure()
      setOpen(true)
    })
  }, [measure])

  const hide = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onScroll = () => hide()
    const onResize = () => measure()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, hide, measure])

  return (
    <>
      <div
        ref={triggerRef}
        className="relative z-[1] flex w-full justify-center px-1 py-px"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={() => {
          requestAnimationFrame(() => {
            measure()
            setOpen(true)
          })
        }}
        onBlurCapture={(e) => {
          const next = e.relatedTarget as Node | null
          if (!next || !triggerRef.current?.contains(next)) hide()
        }}
      >
        {children}
      </div>
      {open &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[9999] -translate-y-1/2"
            style={{ top: pos.top, left: pos.left }}
          >
            <RailTooltipBubble label={label} />
          </div>,
          document.body,
        )}
    </>
  )
}

function isPathActive(pathname: string, href: string, exactMatch?: boolean) {
  if (exactMatch) return pathname === href
  const homeHref = href === '/dashboard'
  const atHome = pathname === '/' || pathname === '/dashboard'
  if (homeHref && atHome) return true
  return pathname === href || pathname.startsWith(`${href}/`)
}

function navItemKey(item: NavItem) {
  return `${item.href}::${item.label}`
}

type PillRect = { top: number; height: number; opacity: number }

const HIDDEN_PILL: PillRect = { top: 0, height: 32, opacity: 0 }

function useActivePill(navRef: React.RefObject<HTMLElement | null>, activeKey: string | null) {
  const [pill, setPill] = useState<PillRect>(HIDDEN_PILL)

  const measure = useCallback(() => {
    const nav = navRef.current
    if (!nav || !activeKey) {
      setPill(HIDDEN_PILL)
      return
    }
    const activeEl = nav.querySelector<HTMLElement>(`[data-rail-key="${activeKey}"]`)
    if (!activeEl) {
      setPill(HIDDEN_PILL)
      return
    }
    const navRect = nav.getBoundingClientRect()
    const elRect = activeEl.getBoundingClientRect()
    setPill({
      top: elRect.top - navRect.top + nav.scrollTop,
      height: elRect.height,
      opacity: 1,
    })
  }, [navRef, activeKey])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(nav)
    nav.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      nav.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [navRef, measure])

  return pill
}

function SidebarNavGroup({ items, className }: { items: NavItem[]; className?: string }) {
  const { pathname } = useLocation()
  const navRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const activeItem = items.find((item) => isPathActive(pathname, item.href, item.exactMatch))
  const activeKey = activeItem ? navItemKey(activeItem) : null
  const pill = useActivePill(navRef, activeKey)

  return (
    <div ref={navRef} className={cn('relative flex flex-col gap-px', className)}>
      <motion.div
        aria-hidden
        className={cn('pointer-events-none absolute left-1 right-1 z-0', railActivePillClass)}
        initial={false}
        animate={{
          top: pill.top,
          height: pill.height,
          opacity: pill.opacity,
        }}
        transition={reduceMotion ? { duration: 0.12 } : railSpring}
      />
      {items.map((item) => (
        <RailNavLink
          key={navItemKey(item)}
          railKey={navItemKey(item)}
          to={item.href}
          label={item.label}
          icon={item.icon}
          exactMatch={item.exactMatch}
          isActive={navItemKey(item) === activeKey}
        />
      ))}
    </div>
  )
}

function RailNavLink({
  to,
  label,
  icon: Icon,
  exactMatch,
  isActive,
  railKey,
}: {
  to: string
  label: string
  icon: LucideIcon
  exactMatch?: boolean
  isActive: boolean
  railKey: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <SidebarRailTooltip label={label}>
      <NavLink
        to={to}
        data-rail-key={railKey}
        onMouseEnter={() => {
          setHovered(true)
          prefetchRouteChunkByHref(to)
        }}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => prefetchRouteChunkByHref(to)}
        className={cn(
          'relative z-[1] flex shrink-0 items-center justify-center outline-none',
          RAIL_ITEM,
          railFocusRing,
          isActive ? railNavActiveClassName : railNavIdleClassName,
        )}
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
      >
        <span className="flex size-full items-center justify-center" aria-hidden>
          <SidebarAnimateIcon
            href={to}
            fallback={Icon}
            isActive={isActive}
            parentHovered={hovered}
            className={isActive ? railNavActiveClassName : undefined}
          />
        </span>
      </NavLink>
    </SidebarRailTooltip>
  )
}

function RailIconButton({
  label,
  onClick,
  danger,
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <SidebarRailTooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={label}
        className={cn(
          'relative z-[1] flex shrink-0 items-center justify-center outline-none',
          RAIL_ITEM,
          'transition-colors duration-150',
          railFocusRing,
          danger
            ? 'text-zinc-400 hover:bg-status-expired/10 hover:text-status-expired dark:text-white/35 dark:hover:bg-status-expired/12'
            : railNavIdleClassName,
        )}
      >
        <SidebarLogOutIcon parentHovered={hovered} />
      </button>
    </SidebarRailTooltip>
  )
}

function flattenSidebarNavItems(role: AppRole | undefined) {
  const blocks = getSidebarBlocks(role)
  const items: NavItem[] = []
  for (const block of blocks) {
    if (block.kind === 'divider') continue
    if (block.kind === 'items' || block.kind === 'section') {
      items.push(...block.items)
    }
  }
  return items
}

export function Sidebar() {
  const { profile, reset } = useAuthStore()
  const navigate = useAppNavigate()
  const role = profile?.role
  const mainNavItems = flattenSidebarNavItems(role)
  const footerNavItems: NavItem[] = [{ label: 'Configuración', href: '/settings', icon: Settings }]

  async function handleLogout() {
    await supabase.auth.signOut()
    reset()
    navigate('/login')
    toast.success('Sesión cerrada', { position: 'bottom-center' })
  }

  return (
    <div className={railShellClass}>
      <aside className={railPanelClass}>
      <div className="flex h-12 shrink-0 items-center justify-center border-b border-[rgb(var(--sidebar-border)/0.12)] dark:border-[rgb(var(--sidebar-border)/0.06)]">
        <SidebarRailTooltip label="Inicio · panel">
          <NavLink
            to="/dashboard"
            className={cn(
              'relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-lg outline-none transition-colors',
              'hover:bg-zinc-200/80 dark:hover:bg-white/8',
              railFocusRing,
            )}
            aria-label="Inicio"
          >
            <BrandLogo size="sm" decorative />
          </NavLink>
        </SidebarRailTooltip>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scrollbar-hide">
        <SidebarNavGroup items={mainNavItems} className="py-1.5" />
      </nav>

      <div className="shrink-0 border-t border-[rgb(var(--sidebar-border)/0.12)] dark:border-[rgb(var(--sidebar-border)/0.06)]">
        <SidebarNavGroup items={footerNavItems} className="py-1.5" />
        <RailIconButton label="Cerrar sesión" danger onClick={() => void handleLogout()} />
      </div>
      </aside>
    </div>
  )
}

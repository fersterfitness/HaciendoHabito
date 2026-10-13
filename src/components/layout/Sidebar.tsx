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
import { PanelLeftClose, PanelLeftOpen, Settings, type LucideIcon } from 'lucide-react'
import { SidebarAnimateIcon, SidebarLogOutIcon } from '@/components/icons/sidebarAnimateIcons'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useSidebar } from '@/contexts/SidebarContext'
import toast from 'react-hot-toast'
import { getSidebarBlocks, isNavPathActive, type NavItem } from '@/config/navigation'
import type { AppRole } from '@/types/database'
import { prefetchRouteChunkByHref } from '@/lib/prefetchRouteChunks'

/** Contenedor flotante: margen + sombra (el rail va dentro). */
const railShellClass = cn(
  'hidden lg:flex shrink-0 sticky top-0 z-30 h-screen flex-col py-3 pl-3 print:hidden',
)

const railPanelClass = cn(
  'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl',
  'border border-surface-border/80 bg-[rgb(var(--surface-sidebar))] shadow-card-md',
  'dark:border-white/[0.06]',
  'transition-[width] duration-300 ease-out-expo motion-reduce:transition-none',
)

/**
 * Pastilla activa sobria: superficie apenas elevada + ícono naranja + barrita de acento.
 * El naranja queda para el ícono; los CTA siguen siendo lo único con degradé.
 */
const railActivePillClass = cn(
  'rounded-lg bg-surface-card ring-1 ring-inset ring-surface-border shadow-[var(--highlight-top),var(--shadow-xs)]',
  'dark:bg-white/[0.07] dark:ring-white/[0.06]',
)

/** Rebote suave al cambiar de ítem. */
const railSpring = { type: 'spring' as const, stiffness: 380, damping: 30, mass: 0.8 }

const railFocusRing = cn(
  'focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2',
  'focus-visible:ring-offset-[rgb(var(--surface-sidebar))]',
)

const railNavIdleClassName = cn(
  'text-ink-muted hover:text-ink-primary hover:bg-surface-border/50',
  'dark:text-white/45 dark:hover:text-white/90 dark:hover:bg-white/[0.04]',
)

function RailTooltipBubble({ label }: { label: string }) {
  return (
    <span
      className={cn(
        'inline-block max-w-[min(14rem,calc(100vw-4.5rem))] truncate rounded-md px-2.5 py-1',
        'border border-surface-border/90 bg-surface-card text-2xs font-medium leading-snug tracking-tight text-ink-primary',
        'shadow-card-md',
        'dark:border-white/10 dark:bg-zinc-900/95 dark:text-white/90 dark:shadow-[0_6px_20px_rgba(0,0,0,0.4)]',
      )}
    >
      {label}
    </span>
  )
}

/** Tooltip a la derecha del ítem; solo con la barra contraída (abierta ya muestra el nombre). */
function SidebarRailTooltip({ label, children }: { label: string; children: ReactNode }) {
  const { expanded } = useSidebar()
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
    if (expanded) return
    requestAnimationFrame(() => {
      measure()
      setOpen(true)
    })
  }, [measure, expanded])

  const hide = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (expanded) setOpen(false)
  }, [expanded])

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
        className={cn('relative z-[1] flex w-full py-px', expanded ? 'px-2' : 'justify-center px-1')}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={show}
        onBlurCapture={(e) => {
          const next = e.relatedTarget as Node | null
          if (!next || !triggerRef.current?.contains(next)) hide()
        }}
      >
        {children}
      </div>
      {open && !expanded &&
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

function navItemKey(item: NavItem) {
  return `${item.href}::${item.label}`
}

type PillRect = { top: number; left: number; width: number; height: number; opacity: number }

const HIDDEN_PILL: PillRect = { top: 0, left: 0, width: 32, height: 32, opacity: 0 }

function useActivePill(navRef: React.RefObject<HTMLElement | null>, activeKey: string | null, expanded: boolean) {
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
      left: elRect.left - navRect.left,
      width: elRect.width,
      height: elRect.height,
      opacity: 1,
    })
  }, [navRef, activeKey])

  useLayoutEffect(() => {
    measure()
  }, [measure, expanded])

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

function SidebarNavGroup({ items, title, className }: { items: NavItem[]; title?: string; className?: string }) {
  const { pathname } = useLocation()
  const { expanded } = useSidebar()
  const navRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const activeItem = items.find((item) => isNavPathActive(pathname, item))
  const activeKey = activeItem ? navItemKey(activeItem) : null
  const pill = useActivePill(navRef, activeKey, expanded)

  return (
    <div className={className}>
      {title && expanded ? (
        <p className="truncate px-4 pb-1 pt-2 text-3xs font-semibold uppercase tracking-[0.14em] text-ink-muted/80">
          {title}
        </p>
      ) : null}
      <div ref={navRef} className="relative flex flex-col gap-px">
        <motion.div
          aria-hidden
          className={cn('pointer-events-none absolute z-0', railActivePillClass)}
          initial={false}
          animate={{
            top: pill.top,
            left: pill.left,
            width: pill.width,
            height: pill.height,
            opacity: pill.opacity,
          }}
          transition={reduceMotion ? { duration: 0.12 } : railSpring}
        >
          {/* Barrita de acento a la izquierda */}
          <span className="absolute -left-px top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gradient" />
        </motion.div>
        {items.map((item) => (
          <RailNavLink
            key={navItemKey(item)}
            railKey={navItemKey(item)}
            to={item.href}
            label={item.label}
            icon={item.icon}
            isActive={navItemKey(item) === activeKey}
          />
        ))}
      </div>
    </div>
  )
}

function RailNavLink({
  to,
  label,
  icon: Icon,
  isActive,
  railKey,
}: {
  to: string
  label: string
  icon: LucideIcon
  isActive: boolean
  railKey: string
}) {
  const { expanded } = useSidebar()
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
          'relative z-[1] flex h-8 shrink-0 items-center rounded-lg outline-none transition-colors duration-150',
          expanded ? 'w-full gap-2.5 px-2' : 'w-8 justify-center',
          railFocusRing,
          isActive ? 'text-ink-primary' : railNavIdleClassName,
          isActive && 'hover:bg-transparent',
        )}
        aria-current={isActive ? 'page' : undefined}
        aria-label={expanded ? undefined : label}
      >
        <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
          <SidebarAnimateIcon
            href={to}
            fallback={Icon}
            isActive={isActive}
            parentHovered={hovered}
            className={isActive ? 'text-brand-primary' : undefined}
          />
        </span>
        {expanded ? (
          <span className={cn('truncate text-body-sm', isActive ? 'font-semibold' : 'font-medium')}>{label}</span>
        ) : null}
      </NavLink>
    </SidebarRailTooltip>
  )
}

function RailButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: (hovered: boolean) => ReactNode
}) {
  const { expanded } = useSidebar()
  const [hovered, setHovered] = useState(false)

  return (
    <SidebarRailTooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={expanded ? undefined : label}
        className={cn(
          'relative z-[1] flex h-8 shrink-0 items-center rounded-lg outline-none transition-colors duration-150',
          expanded ? 'w-full gap-2.5 px-2' : 'w-8 justify-center',
          railFocusRing,
          danger
            ? 'text-ink-muted hover:bg-status-expired/10 hover:text-status-expired dark:text-white/35 dark:hover:bg-status-expired/12'
            : railNavIdleClassName,
        )}
      >
        <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
          {children(hovered)}
        </span>
        {expanded ? <span className="truncate text-body-sm font-medium">{label}</span> : null}
      </button>
    </SidebarRailTooltip>
  )
}

function sidebarGroups(role: AppRole | undefined): { title?: string; items: NavItem[] }[] {
  const groups: { title?: string; items: NavItem[] }[] = []
  for (const block of getSidebarBlocks(role)) {
    if (block.kind === 'items') groups.push({ items: block.items })
    else if (block.kind === 'section') groups.push({ title: block.title, items: block.items })
  }
  return groups
}

export function Sidebar() {
  const { profile, reset } = useAuthStore()
  const { expanded, toggle } = useSidebar()
  const navigate = useAppNavigate()
  const role = profile?.role
  const groups = sidebarGroups(role)
  const footerNavItems: NavItem[] = [{ label: 'Configuración', href: '/settings', icon: Settings }]

  async function handleLogout() {
    await supabase.auth.signOut()
    reset()
    navigate('/login')
    toast.success('Sesión cerrada', { position: 'bottom-center' })
  }

  return (
    <div className={railShellClass}>
      <aside className={cn(railPanelClass, expanded ? 'w-[13rem]' : 'w-[52px]')} aria-label="Navegación principal">
        <div
          className={cn(
            'flex h-12 shrink-0 items-center border-b border-[rgb(var(--sidebar-border)/0.12)] dark:border-[rgb(var(--sidebar-border)/0.06)]',
            expanded ? 'gap-2 px-3' : 'justify-center',
          )}
        >
          <NavLink
            to="/dashboard"
            className={cn(
              'relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-lg outline-none transition-colors',
              'hover:bg-surface-border/80 dark:hover:bg-white/8',
              railFocusRing,
            )}
            aria-label="Inicio"
            title={expanded ? undefined : 'Inicio · panel'}
          >
            <BrandLogo size="sm" decorative />
          </NavLink>
          {expanded ? (
            <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-ink-primary">Haciéndolo Hábito</span>
          ) : null}
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-1.5 scrollbar-hide">
          {groups.map((g, i) => (
            <SidebarNavGroup
              key={g.title ?? `group-${i}`}
              items={g.items}
              title={g.title}
              className={cn(i > 0 && !expanded && 'mt-1.5 border-t border-[rgb(var(--sidebar-border)/0.08)] pt-1.5')}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t border-[rgb(var(--sidebar-border)/0.12)] py-1.5 dark:border-[rgb(var(--sidebar-border)/0.06)]">
          <SidebarNavGroup items={footerNavItems} />
          <RailButton label={expanded ? 'Contraer barra' : 'Expandir barra'} onClick={toggle}>
            {() => (expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />)}
          </RailButton>
          <RailButton label="Cerrar sesión" danger onClick={() => void handleLogout()}>
            {(hovered) => <SidebarLogOutIcon parentHovered={hovered} />}
          </RailButton>
        </div>
      </aside>
    </div>
  )
}

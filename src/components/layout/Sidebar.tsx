import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { Settings, LogOut, type LucideIcon } from 'lucide-react'
import { SidebarAnimateIcon, SidebarLogOutIcon } from '@/components/icons/sidebarAnimateIcons'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'
import type { AppRole } from '@/types/database'
import { getSidebarBlocks } from '@/config/navigation'
import { prefetchRouteChunkByHref } from '@/lib/prefetchRouteChunks'
import { AvatarOrInitials } from '@/components/account/AvatarOrInitials'

const RAIL_W = 'w-[52px]'
const RAIL_ITEM = 'size-[32px] rounded-lg'

const railFocusRing = cn(
  'focus-visible:ring-2 focus-visible:ring-brand-secondary/35 focus-visible:ring-offset-2',
  'focus-visible:ring-offset-[rgb(var(--surface-sidebar))]',
)

/** Activo: acento secondary sutil en ambos temas. */
const railNavActiveClassName = cn(
  'bg-brand-secondary/12 text-brand-secondary shadow-[inset_0_0_0_1px_rgb(var(--brand-secondary)/0.22)]',
  'dark:bg-brand-secondary/16 dark:shadow-[inset_0_0_0_1px_rgb(var(--brand-secondary)/0.28)]',
)

const railNavIdleClassName = cn(
  'text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900',
  'dark:text-white/40 dark:hover:bg-brand-secondary/10 dark:hover:text-white/90',
)

const railNavBaseTransition = 'transition-[color,background-color,box-shadow] duration-150 ease-out'

/** Tooltip compacto alineado al acento secondary. */
function RailTooltipBubble({ label }: { label: string }) {
  return (
    <span
      className={cn(
        'inline-block max-w-[min(14rem,calc(100vw-4.5rem))] truncate rounded-md px-2.5 py-1',
        'border border-surface-border/90 bg-surface-card text-[11px] font-medium leading-snug tracking-tight text-ink-primary',
        'shadow-card-md',
        'dark:border-brand-secondary/25 dark:bg-zinc-950/95 dark:text-white/90 dark:shadow-[0_6px_20px_rgba(0,0,0,0.4)]',
      )}
    >
      {label}
    </span>
  )
}

/**
 * El nav del rail usa overflow-y-auto: en CSS eso fuerza recorte horizontal y los tooltips
 * `absolute` quedan invisibles. Renderizamos en body con position fixed (como Gray con Portal).
 */
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
        className="relative flex w-full justify-center px-1 py-px"
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

function roleLabel(role: AppRole | undefined) {
  if (role === 'nutritionist') return 'Nutricionista'
  if (role === 'trainer') return 'Entrenador'
  if (role === 'admin') return 'Admin'
  if (role === 'student') return 'Alumno'
  return 'Sin perfil'
}

function isPathActive(pathname: string, href: string, exactMatch?: boolean) {
  if (exactMatch) return pathname === href
  const homeHref = href === '/dashboard'
  const atHome = pathname === '/' || pathname === '/dashboard'
  if (homeHref && atHome) return true
  return pathname === href || pathname.startsWith(`${href}/`)
}

function RailActiveIndicator() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-secondary"
    />
  )
}

function RailNavLink({
  to,
  label,
  icon: Icon,
  exactMatch,
}: {
  to: string
  label: string
  icon: LucideIcon
  exactMatch?: boolean
}) {
  const { pathname } = useLocation()
  const isActive = isPathActive(pathname, to, exactMatch)
  const [hovered, setHovered] = useState(false)

  return (
    <SidebarRailTooltip label={label}>
      <NavLink
        to={to}
        onMouseEnter={() => {
          setHovered(true)
          prefetchRouteChunkByHref(to)
        }}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => prefetchRouteChunkByHref(to)}
        className={cn(
          'relative flex shrink-0 items-center justify-center outline-none',
          RAIL_ITEM,
          railNavBaseTransition,
          railFocusRing,
          isActive ? railNavActiveClassName : railNavIdleClassName,
        )}
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
      >
        {isActive ? <RailActiveIndicator /> : null}
        <span className="flex size-full items-center justify-center" aria-hidden>
          <SidebarAnimateIcon
            href={to}
            fallback={Icon}
            isActive={isActive}
            parentHovered={hovered}
            className={isActive ? 'text-brand-secondary' : undefined}
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
          'relative flex shrink-0 items-center justify-center outline-none',
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

export function Sidebar() {
  const { profile, reset } = useAuthStore()
  const navigate = useAppNavigate()
  const { pathname } = useLocation()
  const role = profile?.role
  const sidebarBlocks = getSidebarBlocks(role)
  const profilePathActive = isPathActive(pathname, '/profile', true)

  async function handleLogout() {
    await supabase.auth.signOut()
    reset()
    navigate('/login')
    toast.success('Sesión cerrada', { position: 'bottom-center' })
  }

  const profileTip = profile
    ? `Perfil · ${profile.full_name} (${roleLabel(profile.role)})`
    : 'Perfil'

  return (
    <aside
      className={cn(
        RAIL_W,
        'hidden lg:flex flex-col shrink-0 h-screen sticky top-0 overflow-visible',
        'border-r border-[rgb(var(--sidebar-border)/0.14)] bg-[rgb(var(--surface-sidebar))]',
        'dark:border-[rgb(var(--sidebar-border)/0.06)]',
        'print:border-0 print:hidden',
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-center border-b border-[rgb(var(--sidebar-border)/0.12)] dark:border-[rgb(var(--sidebar-border)/0.06)]">
        <SidebarRailTooltip label="Inicio · panel">
          <NavLink
            to="/dashboard"
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg outline-none transition-colors',
              'hover:bg-zinc-200/80 dark:hover:bg-brand-secondary/12',
              railFocusRing,
            )}
            aria-label="Inicio"
          >
            <BrandLogo size="sm" decorative />
          </NavLink>
        </SidebarRailTooltip>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overflow-x-hidden py-1.5 scrollbar-hide">
        {sidebarBlocks.map((block, blockIndex) => {
          if (block.kind === 'divider') {
            return (
              <div
                key={`divider-${blockIndex}`}
                className="mx-2.5 my-1.5 h-px shrink-0 bg-zinc-300/80 dark:bg-brand-secondary/12"
                role="separator"
              />
            )
          }

          if (block.kind === 'items') {
            return (
              <Fragment key={`items-${blockIndex}`}>
                {block.items.map((item) => (
                  <RailNavLink
                    key={`${item.href}-${item.label}`}
                    to={item.href}
                    label={item.label}
                    icon={item.icon}
                    exactMatch={item.exactMatch}
                  />
                ))}
              </Fragment>
            )
          }

          return (
            <Fragment key={`section-${block.title}-${blockIndex}`}>
              <div className="mt-1 border-t border-[rgb(var(--sidebar-border)/0.12)] pt-1 dark:border-[rgb(var(--sidebar-border)/0.06)]">
                {block.items.map((item) => (
                  <RailNavLink
                    key={`${item.href}-${item.label}`}
                    to={item.href}
                    label={item.label}
                    icon={item.icon}
                    exactMatch={item.exactMatch}
                  />
                ))}
              </div>
            </Fragment>
          )
        })}
      </nav>

      <div className="shrink-0 space-y-px border-t border-[rgb(var(--sidebar-border)/0.12)] py-1.5 dark:border-[rgb(var(--sidebar-border)/0.06)]">
        <RailNavLink to="/settings" label="Configuración" icon={Settings} />

        <SidebarRailTooltip label={profileTip}>
          <NavLink
            to="/profile"
            className={cn(
              'relative flex shrink-0 items-center justify-center overflow-hidden outline-none',
              RAIL_ITEM,
              railFocusRing,
              profilePathActive
                ? cn(railNavBaseTransition, railNavActiveClassName, 'p-0')
                : 'p-0 transition-opacity duration-150 hover:opacity-90',
            )}
            aria-label={profileTip}
            aria-current={profilePathActive ? 'page' : undefined}
          >
            {profilePathActive ? <RailActiveIndicator /> : null}
            <AvatarOrInitials
              fullName={profile?.full_name ?? '?'}
              avatarUrl={profile?.avatar_url}
              size="sm"
              rounded="xl"
              className={cn(
                'size-full rounded-lg',
                profilePathActive && 'ring-1 ring-brand-secondary/45',
              )}
            />
          </NavLink>
        </SidebarRailTooltip>

        <RailIconButton label="Cerrar sesión" danger onClick={() => void handleLogout()} />
      </div>
    </aside>
  )
}

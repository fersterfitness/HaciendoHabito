import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'
import type { AppRole } from '@/types/database'
import { getSidebarBlocks } from '@/config/navigation'
import { prefetchRouteChunkByHref } from '@/lib/prefetchRouteChunks'
import { AvatarOrInitials } from '@/components/account/AvatarOrInitials'

const RAIL_W = 'w-[56px]'

/** Contenido visual del tooltip (pastilla + caret, estilo Gray). */
function RailTooltipBubble({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full flex-row items-center">
      <span
        aria-hidden
        className="h-0 w-0 shrink-0 border-y-[6px] border-y-transparent border-r-[7px] border-r-white drop-shadow-sm"
      />
      <span
        className={cn(
          '-ml-px min-w-0 max-w-[min(16rem,calc(100vw-5rem))] rounded-full bg-white px-3.5 py-1.5 text-left text-xs font-semibold',
          'tracking-tight text-zinc-900 shadow-[0_4px_16px_rgba(0,0,0,0.14)]',
          'whitespace-normal leading-snug break-words [overflow-wrap:anywhere]',
        )}
      >
        {label}
      </span>
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
    setPos({ top: r.top + r.height / 2, left: r.right + 10 })
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
        className="relative flex w-full justify-center px-1.5 py-0.5"
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
            className="pointer-events-none fixed z-[9999] max-w-[min(18rem,calc(100vw-4rem))] -translate-y-1/2"
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

/** Activo: fondo negro (claro) / blanco (oscuro); icono hereda color, mismo trazo que el resto. */
const railNavActiveClassName = cn(
  'bg-black text-white',
  'dark:bg-white dark:text-black',
)

const railNavBaseTransition = cn(
  'transition-[color,background-color] duration-150 ease-out',
)

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

  return (
    <SidebarRailTooltip label={label}>
      <NavLink
        to={to}
        onMouseEnter={() => prefetchRouteChunkByHref(to)}
        onFocus={() => prefetchRouteChunkByHref(to)}
        className={cn(
          'relative flex size-[34px] shrink-0 items-center justify-center rounded-xl outline-none',
          railNavBaseTransition,
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-secondary/45 dark:focus-visible:ring-brand-secondary/35',
          'focus-visible:ring-offset-zinc-100 dark:focus-visible:ring-offset-[rgb(var(--surface-sidebar))]',
          isActive
            ? railNavActiveClassName
            : cn(
                'text-zinc-500/90 hover:bg-black/[0.035] hover:text-zinc-900',
                'dark:text-white/42 dark:hover:bg-white/[0.04] dark:hover:text-white',
              ),
        )}
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
      >
        <Icon className="size-[17px] shrink-0" strokeWidth={2} aria-hidden />
      </NavLink>
    </SidebarRailTooltip>
  )
}

function RailIconButton({
  label,
  onClick,
  icon: Icon,
  danger,
}: {
  label: string
  onClick: () => void
  icon: LucideIcon
  danger?: boolean
}) {
  return (
    <SidebarRailTooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          'relative flex size-[34px] shrink-0 items-center justify-center rounded-xl outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-400/90 dark:focus-visible:ring-white/35',
          'focus-visible:ring-offset-zinc-100 dark:focus-visible:ring-offset-[rgb(var(--surface-sidebar))]',
          danger
            ? 'text-zinc-400 hover:bg-status-expired/10 hover:text-status-expired dark:text-white/35 dark:hover:bg-status-expired/15 dark:hover:text-status-expired'
            : 'text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-900 dark:text-white/50 dark:hover:bg-white/[0.10] dark:hover:text-white',
        )}
      >
        <Icon className="size-[17px] shrink-0" aria-hidden />
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
    toast.success('Sesión cerrada')
  }

  const profileTip = profile
    ? `Perfil · ${profile.full_name} (${roleLabel(profile.role)})`
    : 'Perfil'

  return (
    <aside
      className={cn(
        RAIL_W,
        'hidden lg:flex flex-col shrink-0 h-screen sticky top-0 overflow-visible',
        'border-r border-black/[0.08] bg-zinc-100 dark:border-white/[0.06] dark:bg-[rgb(var(--surface-sidebar))]',
        'print:border-0 print:hidden',
      )}
    >
      <div
        className="flex h-[54px] shrink-0 items-center justify-center border-b border-black/[0.08] px-0.5 dark:border-white/[0.07]"
        aria-hidden={false}
      >
        <SidebarRailTooltip label="Inicio · panel">
          <NavLink
            to="/dashboard"
            className={cn(
              'flex size-[3.25rem] shrink-0 items-center justify-center rounded-xl outline-none transition-colors',
              'hover:bg-zinc-200/90 dark:hover:bg-white/[0.10]',
              'focus-visible:ring-2 focus-visible:ring-zinc-400/90 focus-visible:ring-offset-2',
              'focus-visible:ring-offset-zinc-100 dark:focus-visible:ring-white/35 dark:focus-visible:ring-offset-[rgb(var(--surface-sidebar))]',
            )}
            aria-label="Inicio"
          >
            <BrandLogo size="sm" decorative />
          </NavLink>
        </SidebarRailTooltip>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden py-2 scrollbar-hide">
        {sidebarBlocks.map((block, blockIndex) => {
          if (block.kind === 'divider') {
            return (
              <div
                key={`divider-${blockIndex}`}
                className="mx-2 my-2 h-px shrink-0 bg-zinc-300 dark:bg-white/10"
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
              <div className="mt-2 border-t border-black/10 pt-2 dark:border-white/[0.08]">
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

      <div className="shrink-0 space-y-0.5 border-t border-black/[0.08] py-2 dark:border-white/[0.07]">
        <RailNavLink to="/settings" label="Configuración" icon={Settings} />

        <SidebarRailTooltip label={profileTip}>
          <NavLink
            to="/profile"
            className={cn(
              'relative flex size-[34px] shrink-0 items-center justify-center rounded-xl outline-none',
              'focus-visible:ring-2 focus-visible:ring-zinc-400/90 focus-visible:ring-offset-2',
              'focus-visible:ring-offset-zinc-100 dark:focus-visible:ring-white/35 dark:focus-visible:ring-offset-[rgb(var(--surface-sidebar))]',
              profilePathActive
                ? cn(railNavBaseTransition, railNavActiveClassName)
                : cn('overflow-hidden transition-opacity duration-200 ease-out hover:opacity-95'),
            )}
            aria-label={profileTip}
            aria-current={profilePathActive ? 'page' : undefined}
          >
            <span className={cn('relative z-[1] flex size-full overflow-hidden rounded-[10px]')}>
              <AvatarOrInitials
                fullName={profile?.full_name ?? '?'}
                avatarUrl={profile?.avatar_url}
                size="sm"
                rounded="xl"
              />
            </span>
          </NavLink>
        </SidebarRailTooltip>

        <RailIconButton
          label="Cerrar sesión"
          icon={LogOut}
          danger
          onClick={() => void handleLogout()}
        />
      </div>
    </aside>
  )
}

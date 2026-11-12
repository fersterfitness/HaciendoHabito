import { useLayoutEffect, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Activity, Apple, ArrowRight, BadgeCheck, Brain, Dumbbell } from 'lucide-react'
import { ROLE_TONE, formatPrice, hasPhoto, silhouetteOf, type MarketplaceRole, type MarketplaceSilhouette } from '@/lib/marketplace'
import { IS_V2 } from '@/lib/uiVersion'
import { cn, getInitials } from '@/lib/utils'
import { teamTotal, useMarketplaceTeam } from '@/stores/marketplaceTeam'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm transition-colors',
    isActive ? 'font-semibold text-ink-primary' : 'text-ink-secondary hover:text-ink-primary',
  )

/**
 * Marco de las páginas públicas del marketplace: encabezado con la marca y el acceso a «Mi equipo».
 * El visitante no eligió versión de interfaz, así que acá siempre se usa el tema nuevo.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  const count = useMarketplaceTeam((s) => s.items.length)

  useLayoutEffect(() => {
    if (IS_V2) return
    const root = document.documentElement
    root.classList.add('ui-v2')
    return () => root.classList.remove('ui-v2')
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-surface-base text-ink-primary">
      <header className="sticky top-0 z-30 border-b border-surface-border bg-surface-base/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 lg:px-6">
          <Link to="/profesionales" className="flex min-h-11 items-center gap-2.5">
            <img src="/app-icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span className="hidden text-base font-semibold tracking-tight sm:inline">Haciéndolo Hábito</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Principal">
            <NavLink to="/profesionales" className={(s) => cn(navLinkClass(s), 'hidden sm:inline-flex')}>
              Profesionales
            </NavLink>
            <NavLink to="/sumate" className={navLinkClass}>
              Soy profesional
            </NavLink>
            <Link
              to="/equipo"
              className="ml-1 inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink-primary px-4 text-sm font-medium text-surface-base transition-opacity hover:opacity-90"
            >
              Mi equipo
              {count > 0 ? (
                <span className="rounded-full bg-status-ok px-2 py-px text-xs font-semibold tabular-nums text-black">{count}</span>
              ) : null}
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t border-surface-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-5 text-body-sm text-ink-muted lg:px-6">
          <span>Haciéndolo Hábito · Cada profesional carga sus planes y sus precios.</span>
          <Link to="/sumate" className="font-medium text-ink-secondary hover:text-ink-primary">
            ¿Sos profesional? Sumate
          </Link>
        </div>
      </footer>
    </div>
  )
}

const ROLE_ICON = { entrenador: Dumbbell, nutricionista: Apple, psicologo: Brain, kinesiologo: Activity } as const

export function RoleIcon({ rol, className }: { rol: MarketplaceRole; className?: string }) {
  const Icon = ROLE_ICON[rol] ?? Dumbbell
  return <Icon className={className} aria-hidden="true" />
}

/** Cuadrado pastel con el ícono del área. */
export function RoleTile({ rol, className, iconClassName }: { rol: MarketplaceRole; className?: string; iconClassName?: string }) {
  return (
    <span className={cn('hh-pastel flex shrink-0 items-center justify-center rounded-xl', ROLE_TONE[rol], className)}>
      <RoleIcon rol={rol} className={cn('h-5 w-5', iconClassName)} />
    </span>
  )
}

/** Busto en sombra: el cuerpo y el pelo en la tinta del área, la cara un poco más clara. */
function Silhouette({ kind }: { kind: MarketplaceSilhouette }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" className="h-5/6 w-5/6" aria-hidden="true">
      <g fill="currentColor" fillOpacity="0.32">
        {kind === 'mujer' ? (
          <>
            <path d="M26 47C26 25 36 14 50 14s24 11 24 33c0 12 3 20 8 27-11 5-22 1-27-8H45c-5 9-16 13-27 8 5-7 8-15 8-27Z" />
            <path d="M17 100c0-17 14-27 33-27s33 10 33 27Z" />
          </>
        ) : kind === 'hombre' ? (
          <>
            <path d="M33 37c0-13 7-21 17-21s17 8 17 21-7 23-17 23-17-10-17-23Z" />
            <path d="M42 56h16v12H42Z" />
            <path d="M7 100c0-19 13-30 33-33h20c20 3 33 14 33 33Z" />
          </>
        ) : (
          <>
            <circle cx="50" cy="40" r="18" />
            <path d="M12 100c0-20 16-32 38-32s38 12 38 32Z" />
          </>
        )}
      </g>
      {kind === 'mujer' ? <ellipse cx="50" cy="42" rx="14" ry="17" fill="rgb(var(--surface-card))" fillOpacity="0.5" /> : null}
      {kind === 'hombre' ? (
        <path d="M33 34c0-11 7-18 17-18s17 7 17 18c-5-6-11-8-17-8s-12 2-17 8Z" fill="currentColor" fillOpacity="0.28" />
      ) : null}
    </svg>
  )
}

/** Foto del profesional o, si no cargó, una silueta (sobre el color de su área si se pasa `rol`). */
export function ProfessionalPhoto({
  fotoUrl,
  rol,
  className,
}: {
  /** Se mantiene por compatibilidad con quien ya lo pasa; la silueta no lo usa. */
  nombre?: string
  fotoUrl: string | null
  rol?: MarketplaceRole
  className?: string
}) {
  const base = 'shrink-0 overflow-hidden rounded-xl'
  if (hasPhoto(fotoUrl)) {
    return <img src={fotoUrl} alt="" loading="lazy" className={cn(base, 'border border-surface-border bg-surface-elevated object-cover', className)} />
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        base,
        'flex items-end justify-center',
        rol ? cn('hh-pastel', ROLE_TONE[rol]) : 'border border-surface-border bg-surface-elevated text-ink-secondary',
        className,
      )}
    >
      <Silhouette kind={silhouetteOf(fotoUrl)} />
    </div>
  )
}

export function VerifiedMark({ withLabel = false }: { withLabel?: boolean }) {
  if (withLabel) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-status-ok/15 px-2 py-1 text-xs font-semibold text-status-ok-ink">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Verificado
      </span>
    )
  }
  return <BadgeCheck className="h-4 w-4 shrink-0 text-status-ok-ink" role="img" aria-label="Verificado" />
}

/** Barra flotante con el equipo armado hasta ahora. Solo aparece si hay algún plan sumado. */
export function TeamBar({ className }: { className?: string }) {
  const items = useMarketplaceTeam((s) => s.items)
  if (items.length === 0) return null
  return (
    <div className={cn('pointer-events-none sticky bottom-0 z-20 px-3 pb-3 pt-2', className)}>
      <Link
        to="/equipo"
        className="pointer-events-auto mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl bg-ink-primary py-2.5 pl-3 pr-2.5 text-surface-base shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <span className="flex -space-x-2" aria-hidden="true">
          {items.slice(0, 3).map((i) => (
            <span
              key={i.professionalId}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-base text-xs font-semibold text-ink-primary ring-2 ring-ink-primary"
            >
              {getInitials(i.nombre)}
            </span>
          ))}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-sm font-semibold">
            Tu equipo · {items.length} {items.length === 1 ? 'plan' : 'planes'}
          </span>
          <span className="truncate text-xs opacity-70">{items.map((i) => i.nombre.split(' ')[0]).join(', ')}</span>
        </span>
        <span className="text-base font-semibold tabular-nums">{formatPrice(teamTotal(items))}</span>
        <span className="flex h-10 items-center gap-1.5 rounded-xl bg-status-ok px-3.5 text-sm font-semibold text-black">
          <span className="hidden sm:inline">Ver equipo</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </div>
  )
}

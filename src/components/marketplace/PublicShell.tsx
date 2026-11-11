import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import { useMarketplaceTeam } from '@/stores/marketplaceTeam'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-11 items-center rounded-lg px-2 text-sm transition-colors',
    isActive ? 'font-semibold text-ink-primary' : 'text-ink-secondary hover:text-ink-primary',
  )

/** Marco de las páginas públicas del marketplace: encabezado con la marca y el acceso a «Mi equipo». */
export function PublicShell({ children }: { children: ReactNode }) {
  const count = useMarketplaceTeam((s) => s.items.length)

  return (
    <div className="flex min-h-screen flex-col bg-surface-base text-ink-primary">
      <header className="border-b border-surface-border bg-surface-base">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 lg:px-6">
          <Link to="/profesionales" className="flex min-h-11 items-center gap-2.5">
            <img src="/app-icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-base font-semibold">Haciéndolo Hábito</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Principal">
            <NavLink to="/profesionales" className={navLinkClass}>
              Profesionales
            </NavLink>
            <NavLink to="/sumate" className={navLinkClass}>
              Soy profesional
            </NavLink>
            <Link
              to="/equipo"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-surface-inputBorder px-4 text-sm font-medium text-ink-primary transition-colors hover:bg-surface-elevated"
            >
              Mi equipo
              {count > 0 ? (
                <span className="rounded-full bg-brand-hover px-2 py-px text-xs font-semibold text-white">{count}</span>
              ) : null}
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}

/** Foto del profesional o, si no cargó, sus iniciales. */
export function ProfessionalPhoto({
  nombre,
  fotoUrl,
  className,
}: {
  nombre: string
  fotoUrl: string | null
  className?: string
}) {
  const base = cn('shrink-0 overflow-hidden rounded-xl border border-surface-border bg-surface-elevated', className)
  if (fotoUrl) {
    return <img src={fotoUrl} alt="" loading="lazy" className={cn(base, 'object-cover')} />
  }
  return (
    <div aria-hidden="true" className={cn(base, 'flex items-center justify-center font-semibold text-ink-secondary')}>
      {getInitials(nombre)}
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

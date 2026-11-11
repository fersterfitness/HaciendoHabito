import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PublicShell, ProfessionalPhoto, VerifiedMark } from '@/components/marketplace/PublicShell'
import { useDirectory } from '@/data/marketplace'
import { controlSelectClassName } from '@/lib/formControlClasses'
import {
  DIRECTORY_PAGE_SIZE,
  MARKETPLACE_ROLES,
  MARKETPLACE_SPORTS,
  PRICE_RANGES,
  formatPrice,
  modalityLabel,
  roleLabel,
  sportLabel,
  type DirectoryFilters,
  type DirectorySort,
  type MarketplaceDirectoryRow,
  type MarketplaceModality,
  type MarketplaceRole,
} from '@/lib/marketplace'
import { cn } from '@/lib/utils'
import { teamTotal, useMarketplaceTeam } from '@/stores/marketplaceTeam'

const ROLE_VALUES = new Set(MARKETPLACE_ROLES.map((r) => r.value))
const SORTS: { value: DirectorySort; label: string }[] = [
  { value: 'destacados', label: 'Destacados primero' },
  { value: 'precio-asc', label: 'Menor precio' },
  { value: 'precio-desc', label: 'Mayor precio' },
]

/** Los filtros viven en la dirección: se puede compartir «/profesionales?deporte=boxeo». */
function useDirectoryFilters(): [DirectoryFilters, (patch: Partial<DirectoryFilters>) => void] {
  const [sp, setSp] = useSearchParams()
  const filters = useMemo<DirectoryFilters>(() => {
    const rol = sp.get('rol') ?? ''
    const modalidad = sp.get('modalidad') ?? ''
    const orden = sp.get('orden') ?? ''
    return {
      q: sp.get('q') ?? '',
      rol: ROLE_VALUES.has(rol as MarketplaceRole) ? (rol as MarketplaceRole) : '',
      deporte: sp.get('deporte') ?? '',
      modalidad: modalidad === 'online' || modalidad === 'presencial' ? (modalidad as MarketplaceModality) : '',
      precio: PRICE_RANGES.some((r) => r.value === sp.get('precio')) ? (sp.get('precio') as string) : '',
      orden: SORTS.some((s) => s.value === orden) ? (orden as DirectorySort) : 'destacados',
      page: Math.max(1, Number.parseInt(sp.get('pagina') ?? '1', 10) || 1),
    }
  }, [sp])

  const update = (patch: Partial<DirectoryFilters>) => {
    const next = { ...filters, ...patch }
    // Cambiar un filtro vuelve a la primera página.
    if (!('page' in patch)) next.page = 1
    const out = new URLSearchParams()
    if (next.q) out.set('q', next.q)
    if (next.rol) out.set('rol', next.rol)
    if (next.deporte) out.set('deporte', next.deporte)
    if (next.modalidad) out.set('modalidad', next.modalidad)
    if (next.precio) out.set('precio', next.precio)
    if (next.orden !== 'destacados') out.set('orden', next.orden)
    if (next.page > 1) out.set('pagina', String(next.page))
    setSp(out, { replace: !('page' in patch) })
  }
  return [filters, update]
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-40 flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(controlSelectClassName, 'h-11')}>
        {children}
      </select>
    </div>
  )
}

function ProfessionalCard({ p }: { p: MarketplaceDirectoryRow }) {
  const badge = p.especialidades[0] ?? (p.deportes[0] ? sportLabel(p.deportes[0]) : null)
  const mode = modalityLabel(p.modalidad)
  return (
    <article className="flex flex-col gap-3.5 rounded-xl border border-surface-border bg-surface-card p-4">
      <div className="flex items-center gap-3.5">
        <ProfessionalPhoto nombre={p.nombre} fotoUrl={p.foto_url} className="h-16 w-16 text-xl" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-base font-semibold">{p.nombre}</h2>
            {p.verificado ? <VerifiedMark /> : null}
          </div>
          <p className="text-sm text-ink-secondary">{roleLabel(p.rol)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {badge ? <span className="rounded-md hh-pastel bg-pastel-peach px-2 py-1 text-xs font-semibold text-pastel-peach-ink">{badge}</span> : null}
        {mode ? <span className="rounded-md bg-surface-elevated px-2 py-1 text-xs font-medium text-ink-secondary">{mode}</span> : null}
      </div>
      {p.deportes.length ? (
        <p className="line-clamp-1 text-body-sm text-ink-muted">{p.deportes.map(sportLabel).join(' · ')}</p>
      ) : null}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-surface-border pt-3.5">
        <div className="flex flex-col">
          <span className="text-xs text-ink-muted">Desde</span>
          <span className="text-xl font-bold tabular-nums">{formatPrice(p.precio_desde)}</span>
        </div>
        <Button asChild variant="secondary" size="lg">
          <Link to={`/p/${p.slug}`}>Ver planes</Link>
        </Button>
      </div>
    </article>
  )
}

function CardSkeleton() {
  return <div className="h-56 animate-pulse rounded-xl border border-surface-border bg-surface-elevated/60" aria-hidden="true" />
}

export function MarketplaceDirectoryPage() {
  const [filters, update] = useDirectoryFilters()
  const [search, setSearch] = useState(filters.q)
  const { data, isPending, isError, isPlaceholderData, refetch } = useDirectory(filters)
  const team = useMarketplaceTeam((s) => s.items)

  useEffect(() => {
    document.title = 'Profesionales · Haciéndolo Hábito'
  }, [])

  // El buscador filtra solo, medio segundo después de dejar de escribir.
  useEffect(() => {
    if (search.trim() === filters.q) return
    const t = window.setTimeout(() => update({ q: search.trim() }), 450)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `update` cambia en cada render
  }, [search])

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE))
  const from = total === 0 ? 0 : (filters.page - 1) * DIRECTORY_PAGE_SIZE + 1
  const to = Math.min(total, filters.page * DIRECTORY_PAGE_SIZE)
  const hasFilters = Boolean(filters.q || filters.rol || filters.deporte || filters.modalidad || filters.precio)

  return (
    <PublicShell>
      <section className="border-b border-surface-border bg-surface-panel">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-9 lg:px-6 lg:py-12">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
            Armá tu equipo con los profesionales que elijas
          </h1>
          <p className="max-w-2xl text-base text-ink-secondary">
            Entrenadores, nutricionistas, psicólogos y kinesiólogos. Filtrá por tu deporte, elegí un plan de cada uno y
            sumalos a tu equipo.
          </p>
          <div className="max-w-2xl">
            <Input
              type="search"
              aria-label="Buscar profesional"
              placeholder="Buscar por nombre, deporte o especialidad"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              className="h-12 text-base"
            />
          </div>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 lg:px-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por rol">
          {[{ value: '' as const, plural: 'Todos' }, ...MARKETPLACE_ROLES].map((r) => {
            const on = filters.rol === r.value
            return (
              <Button
                key={r.value || 'todos'}
                variant={on ? 'primary' : 'secondary'}
                size="lg"
                aria-pressed={on}
                onClick={() => update({ rol: r.value })}
                className="rounded-full"
              >
                {r.plural}
              </Button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect id="f-deporte" label="Deporte" value={filters.deporte} onChange={(v) => update({ deporte: v })}>
            <option value="">Todos los deportes</option>
            {MARKETPLACE_SPORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            id="f-modalidad"
            label="Modalidad"
            value={filters.modalidad}
            onChange={(v) => update({ modalidad: v as MarketplaceModality | '' })}
          >
            <option value="">Online y presencial</option>
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
          </FilterSelect>
          <FilterSelect id="f-precio" label="Precio desde" value={filters.precio} onChange={(v) => update({ precio: v })}>
            {PRICE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect id="f-orden" label="Ordenar por" value={filters.orden} onChange={(v) => update({ orden: v as DirectorySort })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </FilterSelect>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-muted" aria-live="polite">
            {isPending
              ? 'Buscando profesionales…'
              : isError
                ? ''
                : total === 0
                  ? 'Sin resultados'
                : `${total} ${total === 1 ? 'profesional' : 'profesionales'} · mostrando ${from} a ${to}`}
          </p>
          {hasFilters ? (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                setSearch('')
                update({ q: '', rol: '', deporte: '', modalidad: '', precio: '' })
              }}
            >
              Quitar filtros
            </Button>
          ) : null}
        </div>

        {isError ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-surface-border p-6">
            <p className="text-sm text-ink-secondary">No pudimos cargar los profesionales. Revisá tu conexión y probá de nuevo.</p>
            <Button variant="secondary" size="lg" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        ) : isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-inputBorder p-8 text-center">
            <p className="text-base font-semibold">
              {hasFilters ? 'Ningún profesional coincide con esos filtros' : 'Todavía no hay profesionales publicados'}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {hasFilters ? 'Probá con otro deporte o quitá algún filtro.' : 'Volvé en unos días: estamos sumando al equipo.'}
            </p>
          </div>
        ) : (
          <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', isPlaceholderData && 'opacity-60')}>
            {data!.rows.map((p) => (
              <ProfessionalCard key={p.id} p={p} />
            ))}
          </div>
        )}

        {pages > 1 ? (
          <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Páginas">
            <Button variant="secondary" size="lg" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>
              Anterior
            </Button>
            <span className="px-2 text-sm tabular-nums text-ink-secondary">
              Página {filters.page} de {pages}
            </span>
            <Button variant="secondary" size="lg" disabled={filters.page >= pages} onClick={() => update({ page: filters.page + 1 })}>
              Siguiente
            </Button>
          </nav>
        ) : null}
      </main>

      {team.length > 0 ? (
        <div className="sticky bottom-0 border-t border-surface-border bg-surface-inverse text-white">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <p className="text-sm">
              <span className="font-semibold">
                Tu equipo: {team.length} {team.length === 1 ? 'plan' : 'planes'} · {formatPrice(teamTotal(team))}
              </span>
              <span className="ml-2 hidden text-white/75 sm:inline">{team.map((i) => i.nombre).join(' · ')}</span>
            </p>
            <Button asChild variant="secondary" size="lg">
              <Link to="/equipo">Ver mi equipo</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </PublicShell>
  )
}

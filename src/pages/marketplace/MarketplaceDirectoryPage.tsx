import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, MapPin, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PublicShell, ProfessionalPhoto, RoleIcon, TeamBar, VerifiedMark } from '@/components/marketplace/PublicShell'
import { useDirectory } from '@/data/marketplace'
import { controlSelectClassName } from '@/lib/formControlClasses'
import {
  DIRECTORY_PAGE_SIZE,
  MARKETPLACE_ROLES,
  MARKETPLACE_SPORTS,
  PRICE_RANGES,
  ROLE_TONE,
  formatPrice,
  hasPhoto,
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

const ROLE_VALUES = new Set(MARKETPLACE_ROLES.map((r) => r.value))
const SORTS: { value: DirectorySort; label: string }[] = [
  { value: 'destacados', label: 'Destacados primero' },
  { value: 'precio-asc', label: 'Menor precio' },
  { value: 'precio-desc', label: 'Mayor precio' },
]

const HOW_IT_WORKS = [
  { title: 'Elegí a tus profesionales', text: 'Entrenador, nutricionista, psicólogo, kinesiólogo: los que necesites.' },
  { title: 'Sumá un plan de cada uno', text: 'Ves el precio y lo que incluye antes de decidir.' },
  { title: 'Te escriben por WhatsApp', text: 'Coordinan con vos el inicio y el pago. Acá no se cobra nada.' },
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

/** Desplegable compacto: el nombre del filtro va como etiqueta accesible y la primera opción lo explica. */
function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(controlSelectClassName, 'h-11 min-w-0 flex-1 sm:w-auto sm:flex-none', value && 'font-medium text-ink-primary')}
    >
      {children}
    </select>
  )
}

function ProfessionalCard({ p }: { p: MarketplaceDirectoryRow }) {
  const tags = [...p.especialidades.slice(0, 2), ...p.deportes.slice(0, 2).map(sportLabel)].slice(0, 3)
  const mode = modalityLabel(p.modalidad)
  return (
    <Link
      to={`/p/${p.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-card transition-colors hover:border-surface-inputBorder"
    >
      <div className="relative">
        <ProfessionalPhoto
          nombre={p.nombre}
          fotoUrl={p.foto_url}
          rol={p.rol}
          className="aspect-[4/3] w-full rounded-none border-0 text-5xl"
        />
        <span className={cn('absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold', hasPhoto(p.foto_url) ? cn('hh-pastel', ROLE_TONE[p.rol]) : 'bg-surface-card text-ink-primary')}>
          <RoleIcon rol={p.rol} className="h-3.5 w-3.5" />
          {roleLabel(p.rol)}
        </span>
        {p.destacado ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-ink-primary px-2 py-1 text-xs font-semibold text-surface-base">
            <Star className="h-3 w-3 fill-current" aria-hidden="true" />
            Destacado
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-lg font-semibold tracking-tight">{p.nombre}</h2>
            {p.verificado ? <VerifiedMark /> : null}
          </div>
          <p className="flex items-center gap-1.5 text-body-sm text-ink-muted">
            {p.ubicacion ? (
              <>
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{p.ubicacion}</span>
                {mode ? <span aria-hidden="true">·</span> : null}
              </>
            ) : null}
            {mode ? <span className="shrink-0">{mode}</span> : null}
          </p>
        </div>
        {tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-md bg-surface-elevated px-2 py-1 text-xs font-medium text-ink-secondary">
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-ink-muted">Planes desde</span>
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatPrice(p.precio_desde)}</span>
          </div>
          <span className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-surface-elevated px-3.5 text-sm font-medium text-ink-primary transition-colors group-hover:bg-ink-primary group-hover:text-surface-base">
            Ver planes
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  )
}

function CardSkeleton() {
  return <div className="h-96 animate-pulse rounded-2xl bg-surface-elevated/60" aria-hidden="true" />
}

export function MarketplaceDirectoryPage() {
  const [filters, update] = useDirectoryFilters()
  const [search, setSearch] = useState(filters.q)
  const { data, isPending, isError, isPlaceholderData, refetch } = useDirectory(filters)

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
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 lg:px-6 lg:py-16">
          <div className="flex flex-col gap-5">
            <h1 className="max-w-2xl text-4xl font-semibold leading-none tracking-tight lg:text-6xl">
              Armá tu equipo con los profesionales que elijas
            </h1>
            <p className="max-w-xl text-base text-ink-secondary lg:text-lg">
              Buscá por deporte, mirá los planes de cada uno y sumalos a tu equipo. Sin intermediarios.
            </p>
            <div className="max-w-xl">
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

          <ol className="flex flex-col gap-2" aria-label="Cómo funciona">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="flex items-start gap-3 rounded-xl bg-surface-card p-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-primary text-xs font-semibold tabular-nums text-surface-base">
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{step.title}</span>
                  <span className="text-body-sm text-ink-muted">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 lg:px-6 lg:py-8">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="Filtrar por rol">
          {[{ value: '' as const, plural: 'Todos' }, ...MARKETPLACE_ROLES].map((r) => {
            const on = filters.rol === r.value
            return (
              <Button
                key={r.value || 'todos'}
                variant={on ? 'primary' : 'secondary'}
                size="lg"
                aria-pressed={on}
                onClick={() => update({ rol: r.value })}
                icon={r.value ? <RoleIcon rol={r.value} className="h-4 w-4" /> : undefined}
                className="shrink-0"
              >
                {r.plural}
              </Button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Deporte" value={filters.deporte} onChange={(v) => update({ deporte: v })}>
            <option value="">Todos los deportes</option>
            {MARKETPLACE_SPORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Modalidad" value={filters.modalidad} onChange={(v) => update({ modalidad: v as MarketplaceModality | '' })}>
            <option value="">Online y presencial</option>
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
          </FilterSelect>
          <FilterSelect label="Precio" value={filters.precio} onChange={(v) => update({ precio: v })}>
            {PRICE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </FilterSelect>
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
          <div className="flex w-full items-center justify-between gap-3 sm:ml-auto sm:w-auto">
            <p className="text-sm text-ink-muted" aria-live="polite">
              {isPending
                ? 'Buscando profesionales…'
                : isError
                  ? ''
                  : total === 0
                    ? 'Sin resultados'
                    : pages > 1
                      ? `${from} a ${to} de ${total} profesionales`
                      : `${total} ${total === 1 ? 'profesional' : 'profesionales'}`}
            </p>
            <FilterSelect label="Ordenar por" value={filters.orden} onChange={(v) => update({ orden: v as DirectorySort })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </FilterSelect>
          </div>
        </div>

        {isError ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-surface-panel p-6">
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
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-surface-inputBorder px-6 py-14 text-center">
            <div className="mb-2 flex gap-1.5" aria-hidden="true">
              {MARKETPLACE_ROLES.map((r) => (
                <span key={r.value} className={cn('hh-pastel flex h-10 w-10 items-center justify-center rounded-xl', ROLE_TONE[r.value])}>
                  <RoleIcon rol={r.value} className="h-5 w-5" />
                </span>
              ))}
            </div>
            <p className="text-lg font-semibold tracking-tight">
              {hasFilters ? 'Ningún profesional coincide con esos filtros' : 'Todavía no hay profesionales publicados'}
            </p>
            <p className="text-sm text-ink-muted">
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

      <TeamBar />
    </PublicShell>
  )
}

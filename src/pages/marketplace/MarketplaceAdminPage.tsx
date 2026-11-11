import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { SegmentedV2 } from '@/components/v2/ui'
import { ProfessionalPhoto } from '@/components/marketplace/PublicShell'
import {
  useAdminMarketplace,
  useAdminUpdateProfessional,
  useResolveApplication,
  type AdminProfessionalRow,
} from '@/data/marketplace'
import {
  formatPrice,
  roleLabel,
  sportLabel,
  whatsappLink,
  type MarketplaceApplication,
  type MarketplaceProfessional,
  type MarketplaceProfessionalStatus,
} from '@/lib/marketplace'
import { cn, formatDate } from '@/lib/utils'

type Tab = MarketplaceProfessionalStatus | 'postulaciones'

const STATUS: Record<MarketplaceProfessionalStatus, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-status-warn/20 text-status-warn-ink' },
  aprobado: { label: 'Publicado', className: 'bg-status-ok/15 text-status-ok-ink' },
  oculto: { label: 'Oculto', className: 'bg-surface-elevated text-ink-secondary' },
  borrador: { label: 'Armando', className: 'bg-surface-elevated text-ink-secondary' },
}

function ProfessionalRow({ row }: { row: AdminProfessionalRow }) {
  const update = useAdminUpdateProfessional()
  const patch = (p: Partial<Pick<MarketplaceProfessional, 'estado' | 'verificado' | 'destacado'>>, ok: string) =>
    update.mutate({ id: row.id, patch: p }, { onSuccess: () => toast.success(ok), onError: () => toast.error('No se pudo guardar el cambio.') })

  return (
    <article className="flex flex-wrap items-center gap-3.5 rounded-xl border border-surface-border bg-surface-card p-4">
      <ProfessionalPhoto nombre={row.nombre} fotoUrl={row.foto_url} className="h-12 w-12 text-sm" />
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{row.nombre}</h3>
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', STATUS[row.estado].className)}>{STATUS[row.estado].label}</span>
        </div>
        <p className="text-body-sm text-ink-muted">
          {[
            roleLabel(row.rol),
            row.deportes.map(sportLabel).join(', '),
            row.planes === 0
              ? 'sin planes activos'
              : `${row.planes} ${row.planes === 1 ? 'plan' : 'planes'} · desde ${formatPrice(row.precio_desde ?? 0)}`,
            `alta ${formatDate(row.created_at)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {row.estado === 'aprobado' ? (
          <>
            <Button asChild variant="secondary">
              <a href={`/p/${row.slug}`} target="_blank" rel="noopener noreferrer">
                Ver página
              </a>
            </Button>
            <Button
              variant={row.verificado ? 'soft' : 'secondary'}
              aria-pressed={row.verificado}
              disabled={update.isPending}
              onClick={() => patch({ verificado: !row.verificado }, row.verificado ? 'Ya no figura como verificado' : 'Marcado como verificado')}
            >
              {row.verificado ? 'Verificado' : 'Verificar'}
            </Button>
            <Button
              variant={row.destacado ? 'soft' : 'secondary'}
              aria-pressed={row.destacado}
              disabled={update.isPending}
              onClick={() => patch({ destacado: !row.destacado }, row.destacado ? 'Ya no está destacado' : 'Destacado: sale primero')}
            >
              {row.destacado ? 'Destacado' : 'Destacar'}
            </Button>
            <Button variant="ghost" disabled={update.isPending} onClick={() => patch({ estado: 'oculto' }, 'Página oculta')}>
              Ocultar
            </Button>
          </>
        ) : (
          <Button
            variant={row.estado === 'pendiente' ? 'primary' : 'secondary'}
            disabled={update.isPending || row.planes === 0}
            title={row.planes === 0 ? 'Necesita al menos un plan activo' : undefined}
            onClick={() => patch({ estado: 'aprobado' }, `${row.nombre} ya aparece en el directorio`)}
          >
            {row.estado === 'pendiente' ? 'Aprobar' : 'Publicar'}
          </Button>
        )}
      </div>
    </article>
  )
}

function ApplicationRow({ app }: { app: MarketplaceApplication }) {
  const resolve = useResolveApplication()
  const wa = whatsappLink(app.whatsapp, `Hola ${app.nombre.split(' ')[0]}, recibimos tu postulación en Haciéndolo Hábito.`)
  return (
    <article className="flex flex-wrap items-center gap-3.5 rounded-xl border border-surface-border bg-surface-card p-4">
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{app.nombre}</h3>
          {app.estado === 'resuelta' ? (
            <span className="rounded-md bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-ink-secondary">Resuelta</span>
          ) : null}
        </div>
        <p className="text-body-sm text-ink-muted">
          {[roleLabel(app.rol), app.deportes, app.email, app.whatsapp, formatDate(app.created_at)].filter(Boolean).join(' · ')}
        </p>
        {app.mensaje ? <p className="whitespace-pre-line text-sm text-ink-secondary">{app.mensaje}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {wa ? (
          <Button asChild variant="secondary" icon={<WhatsAppIcon className="h-4 w-4" />}>
            <a href={wa} target="_blank" rel="noopener noreferrer">
              Escribirle
            </a>
          </Button>
        ) : null}
        {app.estado === 'nueva' ? (
          <Button
            disabled={resolve.isPending}
            onClick={() => resolve.mutate(app.id, { onError: () => toast.error('No se pudo marcar como resuelta.') })}
          >
            Marcar resuelta
          </Button>
        ) : null}
      </div>
    </article>
  )
}

export function MarketplaceAdminPage() {
  const { data, isPending, isError, refetch } = useAdminMarketplace(true)
  const [tab, setTab] = useState<Tab>('pendiente')
  const [q, setQ] = useState('')

  useEffect(() => {
    document.title = 'Profesionales de la web · Haciéndolo Hábito'
  }, [])

  const rows = useMemo(() => data?.rows ?? [], [data])
  const applications = useMemo(() => data?.applications ?? [], [data])
  const count = (estado: MarketplaceProfessionalStatus) => rows.filter((r) => r.estado === estado).length
  const term = q.trim().toLowerCase()
  const visible = rows.filter((r) => r.estado === tab && (!term || r.nombre.toLowerCase().includes(term)))
  const visibleApps = applications.filter((a) => !term || a.nombre.toLowerCase().includes(term))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-14 pt-6 lg:px-10 lg:pt-9">
      <div>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">Profesionales de la web</h1>
        <p className="mt-1 text-body-sm text-ink-muted">
          Quien arma su página queda pendiente hasta que lo apruebes. Recién ahí aparece en el directorio.
        </p>
      </div>

      {isPending ? (
        <div className="h-64 animate-pulse rounded-xl bg-surface-elevated/60" aria-label="Cargando" />
      ) : isError ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-surface-border p-6">
          <p className="text-sm text-ink-secondary">
            No se pudo cargar la lista. Si es la primera vez, falta correr la migración del marketplace en Supabase.
          </p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedV2
              value={tab}
              onChange={setTab}
              options={[
                { value: 'pendiente', label: 'Pendientes', count: count('pendiente') },
                { value: 'aprobado', label: 'Publicados', count: count('aprobado') },
                { value: 'oculto', label: 'Ocultos', count: count('oculto') },
                { value: 'borrador', label: 'Armando', count: count('borrador') },
                { value: 'postulaciones', label: 'Postulaciones', count: applications.filter((a) => a.estado === 'nueva').length },
              ]}
            />
            <div className="w-full sm:w-64">
              <Input
                type="search"
                aria-label="Buscar por nombre"
                placeholder="Buscar por nombre"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
          </div>

          {tab === 'postulaciones' ? (
            <>
              <p className="text-body-sm text-ink-muted">
                Profesionales sin cuenta que pidieron sumarse. Creales el acceso como a cualquier profesional; después cargan su
                página desde «Mi página web».
              </p>
              {visibleApps.length === 0 ? (
                <p className="rounded-xl border border-dashed border-surface-inputBorder p-6 text-sm text-ink-muted">No hay postulaciones.</p>
              ) : (
                visibleApps.map((a) => <ApplicationRow key={a.id} app={a} />)
              )}
            </>
          ) : visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-surface-inputBorder p-6 text-sm text-ink-muted">
              {term ? 'Nadie coincide con esa búsqueda.' : tab === 'pendiente' ? 'No hay nadie esperando aprobación.' : 'No hay profesionales en este estado.'}
            </p>
          ) : (
            visible.map((r) => <ProfessionalRow key={r.id} row={r} />)
          )}

          <p className="text-body-sm text-ink-muted">
            Ocultar saca al profesional del directorio y de su link público, pero no borra sus planes ni sus solicitudes.
          </p>
        </>
      )}
    </div>
  )
}

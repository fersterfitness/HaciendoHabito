import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { SegmentedV2 } from '@/components/v2/ui'
import { ProfessionalPhoto } from '@/components/marketplace/PublicShell'
import {
  useDeletePlan,
  useMyMarketplace,
  useSaveMyProfessional,
  useSavePlan,
  useSetRequestStatus,
  type PlanInput,
} from '@/data/marketplace'
import {
  MARKETPLACE_DURATIONS,
  MARKETPLACE_ROLES,
  MARKETPLACE_SPORTS,
  defaultMarketplaceRole,
  durationLabel,
  formatPrice,
  marketplaceSlug,
  whatsappLink,
  type MarketplaceDuration,
  type MarketplaceModality,
  type MarketplacePlan,
  type MarketplaceProfessional,
  type MarketplaceRequest,
  type MarketplaceRequestStatus,
  type MarketplaceRole,
} from '@/lib/marketplace'
import { profileAvatarDisplayUrl } from '@/lib/profileAvatar'
import { cn, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

type Tab = 'perfil' | 'planes' | 'solicitudes'

const errorMessage = (err: unknown) => {
  const e = err as { code?: string; message?: string } | null
  if (e?.code === '23505') return 'Esa dirección ya la usa otro profesional. Probá con otra.'
  if (e?.code === '42P01' || e?.code === 'PGRST205') return 'Falta correr la migración del marketplace en Supabase.'
  return 'No se pudo guardar. Revisá los datos y probá de nuevo.'
}

// ───────────────────────── Perfil ─────────────────────────

function StatusBanner({
  professional,
  activePlans,
  onRequestPublish,
  busy,
}: {
  professional: MarketplaceProfessional
  activePlans: number
  onRequestPublish: () => void
  busy: boolean
}) {
  const url = `${window.location.origin}/p/${professional.slug}`
  if (professional.estado === 'aprobado') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-status-ok/15 px-4 py-3">
        <p className="min-w-0 text-sm text-status-ok-ink">
          <span className="font-semibold">Tu página está publicada.</span> <span className="break-all">{url}</span>
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(
                () => toast.success('Link copiado'),
                () => toast.error('No se pudo copiar'),
              )
            }}
          >
            Copiar link
          </Button>
          <Button asChild variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
            <a href={`/p/${professional.slug}`} target="_blank" rel="noopener noreferrer">
              Ver mi página
            </a>
          </Button>
        </div>
      </div>
    )
  }
  if (professional.estado === 'pendiente') {
    return (
      <p className="rounded-xl bg-status-warn/20 px-4 py-3 text-sm text-status-warn-ink">
        <span className="font-semibold">Esperando aprobación.</span> Cuando el administrador la apruebe, tu página aparece en el
        directorio. Mientras tanto podés seguir editando.
      </p>
    )
  }
  if (professional.estado === 'oculto') {
    return (
      <p className="rounded-xl bg-surface-elevated px-4 py-3 text-sm text-ink-secondary">
        <span className="font-semibold">Tu página está oculta.</span> El administrador la sacó del directorio. Tus planes y
        solicitudes siguen guardados.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-elevated px-4 py-3">
      <p className="text-sm text-ink-secondary">
        <span className="font-semibold text-ink-primary">Tu página todavía no es pública.</span>{' '}
        {activePlans === 0 ? 'Cargá al menos un plan activo y pedí que la publiquen.' : 'Cuando esté lista, pedí que la publiquen.'}
      </p>
      <Button onClick={onRequestPublish} disabled={activePlans === 0} loading={busy}>
        Pedir publicación
      </Button>
    </div>
  )
}

function ProfileForm({ professional }: { professional: MarketplaceProfessional | null }) {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const save = useSaveMyProfessional(user?.id)

  const [nombre, setNombre] = useState(professional?.nombre ?? profile?.full_name ?? '')
  const [slug, setSlug] = useState(professional?.slug ?? marketplaceSlug(profile?.full_name ?? ''))
  const [slugTouched, setSlugTouched] = useState(Boolean(professional))
  const [rol, setRol] = useState<MarketplaceRole>(professional?.rol ?? defaultMarketplaceRole(profile?.role))
  const [deportes, setDeportes] = useState<string[]>(professional?.deportes ?? [])
  const [especialidades, setEspecialidades] = useState((professional?.especialidades ?? []).join(', '))
  const [modalidad, setModalidad] = useState<MarketplaceModality[]>(professional?.modalidad ?? ['online'])
  const [ubicacion, setUbicacion] = useState(professional?.ubicacion ?? '')
  const [whatsapp, setWhatsapp] = useState(professional?.whatsapp ?? profile?.phone ?? '')
  const [bio, setBio] = useState(professional?.bio ?? profile?.bio ?? '')
  const [fotoUrl, setFotoUrl] = useState<string | null>(professional?.foto_url ?? profileAvatarDisplayUrl(profile?.avatar_url))
  const [errors, setErrors] = useState<Partial<Record<'nombre' | 'slug' | 'modalidad', string>>>({})

  const accountPhoto = profileAvatarDisplayUrl(profile?.avatar_url)
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  function onSave() {
    const cleanSlug = marketplaceSlug(slug)
    const next: typeof errors = {}
    if (nombre.trim().length < 2) next.nombre = 'Escribí tu nombre.'
    if (cleanSlug.length < 3) next.slug = 'La dirección necesita al menos 3 letras.'
    if (modalidad.length === 0) next.modalidad = 'Elegí al menos una modalidad.'
    setErrors(next)
    if (Object.keys(next).length) return

    save.mutate(
      {
        id: professional?.id ?? null,
        input: {
          slug: cleanSlug,
          nombre: nombre.trim(),
          rol,
          deportes,
          especialidades: especialidades
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8),
          foto_url: fotoUrl,
          bio: bio.trim(),
          ubicacion: ubicacion.trim(),
          modalidad,
          whatsapp: whatsapp.trim(),
        },
      },
      {
        onSuccess: () => {
          setSlug(cleanSlug)
          toast.success(professional ? 'Perfil guardado' : 'Perfil creado. Ahora cargá tus planes.')
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <ProfessionalPhoto nombre={nombre || 'HH'} fotoUrl={fotoUrl} className="h-20 w-20 text-2xl" />
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Foto de tu página</p>
          <div className="flex flex-wrap gap-2">
            {accountPhoto ? (
              <Button variant="secondary" size="sm" onClick={() => setFotoUrl(accountPhoto)} disabled={fotoUrl === accountPhoto}>
                Usar la foto de mi cuenta
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link to="/settings">Subir una foto en Configuración</Link>
              </Button>
            )}
            {fotoUrl ? (
              <Button variant="ghost" size="sm" onClick={() => setFotoUrl(null)}>
                Quitar foto
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nombre público"
          required
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            if (!slugTouched) setSlug(marketplaceSlug(e.target.value))
          }}
          error={errors.nombre}
          maxLength={80}
        />
        <Input
          label="Dirección de tu página"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true)
            setSlug(e.target.value.toLowerCase())
          }}
          onBlur={() => setSlug(marketplaceSlug(slug))}
          error={errors.slug}
          hint={`${window.location.host}/p/${marketplaceSlug(slug) || 'tu-nombre'}`}
          maxLength={60}
        />
        <Select
          label="Qué hacés"
          options={MARKETPLACE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
          value={rol}
          onChange={(e) => setRol(e.target.value as MarketplaceRole)}
        />
        <Input
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          hint="Con código de país, por ejemplo +54 11 5905 9170."
          maxLength={30}
        />
        <Input
          label="Ubicación"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          hint="Dónde atendés si es presencial."
          maxLength={80}
        />
        <Input
          label="Especialidades"
          value={especialidades}
          onChange={(e) => setEspecialidades(e.target.value)}
          hint="Separadas por coma. La primera se muestra en tu tarjeta."
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-medium text-ink-secondary">Modalidad</legend>
        <div className="flex flex-wrap gap-2">
          {(['online', 'presencial'] as const).map((m) => (
            <Button
              key={m}
              variant={modalidad.includes(m) ? 'primary' : 'secondary'}
              aria-pressed={modalidad.includes(m)}
              onClick={() => setModalidad(toggle(modalidad, m))}
            >
              {m === 'online' ? 'Online' : 'Presencial'}
            </Button>
          ))}
        </div>
        {errors.modalidad ? (
          <p role="alert" className="text-xs text-status-expired">
            {errors.modalidad}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-ink-secondary">Deportes con los que trabajás</legend>
        <div className="flex flex-wrap gap-2">
          {MARKETPLACE_SPORTS.map((s) => {
            const on = deportes.includes(s.value)
            return (
              <Button
                key={s.value}
                variant={on ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={on}
                onClick={() => setDeportes(toggle(deportes, s.value).slice(0, 12))}
                className="rounded-full"
              >
                {s.label}
              </Button>
            )
          })}
        </div>
      </fieldset>

      <Textarea
        label="Sobre vos"
        rows={5}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        hint="Quién sos, con qué deportistas trabajás y cómo es tu método."
        maxLength={1200}
      />

      <div>
        <Button onClick={onSave} loading={save.isPending}>
          {professional ? 'Guardar perfil' : 'Crear mi página'}
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────── Planes ─────────────────────────

function PlanEditor({
  plan,
  professionalId,
  nextOrder,
  onClose,
}: {
  plan: MarketplacePlan | null
  professionalId: string
  nextOrder: number
  onClose: () => void
}) {
  const save = useSavePlan()
  const del = useDeletePlan()
  const [titulo, setTitulo] = useState(plan?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(plan?.descripcion ?? '')
  const [precio, setPrecio] = useState(plan ? String(plan.precio) : '')
  const [duracion, setDuracion] = useState<MarketplaceDuration>(plan?.duracion ?? 'mensual')
  const [modalidad, setModalidad] = useState<MarketplaceModality | ''>(plan?.modalidad ?? '')
  const [incluye, setIncluye] = useState((plan?.incluye ?? []).join('\n'))
  const [cupos, setCupos] = useState(plan?.cupos != null ? String(plan.cupos) : '')
  const [errors, setErrors] = useState<Partial<Record<'titulo' | 'precio' | 'cupos', string>>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  function onSave() {
    const price = Number.parseInt(precio.replace(/\D/g, ''), 10)
    const seats = cupos.trim() === '' ? null : Number.parseInt(cupos, 10)
    const next: typeof errors = {}
    if (titulo.trim().length < 3) next.titulo = 'El título necesita al menos 3 letras.'
    if (!Number.isFinite(price) || price <= 0) next.precio = 'Escribí el precio en pesos, sin puntos ni comas.'
    if (seats !== null && (!Number.isFinite(seats) || seats < 0)) next.cupos = 'Escribí un número o dejalo vacío.'
    setErrors(next)
    if (Object.keys(next).length) return

    const input: PlanInput = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      precio: price,
      duracion,
      modalidad: modalidad || null,
      incluye: incluye
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 16),
      cupos: seats,
      activo: plan?.activo ?? true,
      orden: plan?.orden ?? nextOrder,
    }
    save.mutate(
      { id: plan?.id ?? null, professionalId, input },
      {
        onSuccess: () => {
          toast.success(plan ? 'Plan guardado' : 'Plan creado')
          onClose()
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? 'Editar plan' : 'Nuevo plan'}
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {plan ? (
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true)
                del.mutate(plan.id, {
                  onSuccess: () => {
                    toast.success('Plan borrado')
                    onClose()
                  },
                  onError: () => toast.error('No se pudo borrar el plan.'),
                })
              }}
            >
              {confirmDelete ? 'Confirmar borrado' : 'Borrar plan'}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onSave} loading={save.isPending}>
              Guardar
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Título" required value={titulo} onChange={(e) => setTitulo(e.target.value)} error={errors.titulo} maxLength={80} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Precio en pesos"
            required
            inputMode="numeric"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            error={errors.precio}
            hint={precio && !errors.precio ? formatPrice(Number.parseInt(precio.replace(/\D/g, ''), 10) || 0) : undefined}
          />
          <Select
            label="Duración"
            options={MARKETPLACE_DURATIONS.map((d) => ({ value: d.value, label: d.label }))}
            value={duracion}
            onChange={(e) => setDuracion(e.target.value as MarketplaceDuration)}
          />
          <Select
            label="Modalidad del plan"
            options={[
              { value: '', label: 'Sin aclarar' },
              { value: 'online', label: 'Online' },
              { value: 'presencial', label: 'Presencial' },
            ]}
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value as MarketplaceModality | '')}
          />
          <Input
            label="Cupos"
            inputMode="numeric"
            value={cupos}
            onChange={(e) => setCupos(e.target.value)}
            error={errors.cupos}
            hint="Vacío = sin límite. Con 0 se muestra sin cupos."
          />
        </div>
        <Textarea label="Descripción corta" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={600} />
        <Textarea
          label="Qué incluye"
          rows={5}
          value={incluye}
          onChange={(e) => setIncluye(e.target.value)}
          hint="Un ítem por línea."
        />
      </div>
    </Modal>
  )
}

function PlansTab({ professional, plans }: { professional: MarketplaceProfessional; plans: MarketplacePlan[] }) {
  const save = useSavePlan()
  const [editing, setEditing] = useState<MarketplacePlan | 'new' | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">Lo que cargues acá es lo que ven los clientes. Los cambios de precio se publican al guardar.</p>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
          Nuevo plan
        </Button>
      </div>
      {plans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface-inputBorder p-6 text-sm text-ink-muted">
          Todavía no cargaste planes. Con uno activo ya podés pedir que publiquen tu página.
        </p>
      ) : (
        plans.map((plan) => (
          <article key={plan.id} className="flex flex-wrap items-center gap-3.5 rounded-xl border border-surface-border bg-surface-card p-4">
            <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{plan.titulo}</h3>
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-semibold',
                    plan.activo ? 'bg-status-ok/15 text-status-ok-ink' : 'bg-surface-elevated text-ink-secondary',
                  )}
                >
                  {plan.activo ? 'Activo' : 'Pausado'}
                </span>
              </div>
              <p className="text-body-sm text-ink-muted">
                {[
                  durationLabel(plan.duracion),
                  plan.modalidad === 'online' ? 'Online' : plan.modalidad === 'presencial' ? 'Presencial' : null,
                  plan.cupos == null ? 'sin límite de cupos' : `${plan.cupos} cupos`,
                  plan.activo ? null : 'no se muestra en la web',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <span className="text-lg font-bold tabular-nums">{formatPrice(plan.precio)}</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(plan)}>
                Editar
              </Button>
              <Button
                variant="secondary"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate(
                    { id: plan.id, professionalId: professional.id, input: { activo: !plan.activo } },
                    {
                      onSuccess: () => toast.success(plan.activo ? 'Plan pausado' : 'Plan activado'),
                      onError: (err) => toast.error(errorMessage(err)),
                    },
                  )
                }
              >
                {plan.activo ? 'Pausar' : 'Activar'}
              </Button>
            </div>
          </article>
        ))
      )}
      {editing ? (
        <PlanEditor
          plan={editing === 'new' ? null : editing}
          professionalId={professional.id}
          nextOrder={plans.length}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

// ───────────────────────── Solicitudes ─────────────────────────

const REQUEST_STATUS: Record<MarketplaceRequestStatus, { label: string; className: string }> = {
  nueva: { label: 'Nueva', className: 'hh-pastel bg-pastel-peach text-pastel-peach-ink' },
  contactada: { label: 'Contactada', className: 'bg-status-warn/20 text-status-warn-ink' },
  aceptada: { label: 'Aceptada', className: 'bg-status-ok/15 text-status-ok-ink' },
  descartada: { label: 'Descartada', className: 'bg-surface-elevated text-ink-secondary' },
}

function RequestsTab({ requests }: { requests: MarketplaceRequest[] }) {
  const setStatus = useSetRequestStatus()
  const [filter, setFilter] = useState<'abiertas' | 'cerradas'>('abiertas')
  const open = requests.filter((r) => r.estado === 'nueva' || r.estado === 'contactada')
  const closed = requests.filter((r) => r.estado === 'aceptada' || r.estado === 'descartada')
  const list = filter === 'abiertas' ? open : closed

  const change = (id: string, estado: MarketplaceRequestStatus) =>
    setStatus.mutate({ id, estado }, { onError: () => toast.error('No se pudo actualizar la solicitud.') })

  return (
    <div className="flex flex-col gap-3">
      <SegmentedV2
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'abiertas', label: 'Por responder', count: open.length },
          { value: 'cerradas', label: 'Cerradas', count: closed.length },
        ]}
      />
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface-inputBorder p-6 text-sm text-ink-muted">
          {filter === 'abiertas'
            ? 'No tenés solicitudes por responder. Cuando un cliente te sume a su equipo, aparece acá.'
            : 'Todavía no cerraste ninguna solicitud.'}
        </p>
      ) : (
        list.map((r) => {
          const wa = whatsappLink(r.cliente_whatsapp, `Hola ${r.cliente_nombre.split(' ')[0]}, recibí tu solicitud por ${r.plan_titulo}.`)
          return (
            <article key={r.id} className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{r.cliente_nombre}</h3>
                    <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', REQUEST_STATUS[r.estado].className)}>
                      {REQUEST_STATUS[r.estado].label}
                    </span>
                  </div>
                  <p className="text-body-sm text-ink-muted">
                    {[formatDate(r.created_at), r.deporte, r.cliente_whatsapp, r.cliente_email].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {r.plan_titulo} · {formatPrice(r.plan_precio)}
                </p>
              </div>
              {r.objetivo ? <p className="whitespace-pre-line text-sm text-ink-secondary">{r.objetivo}</p> : null}
              {r.equipo_resumen ? <p className="text-body-sm text-ink-muted">También eligió: {r.equipo_resumen}</p> : null}
              <div className="flex flex-wrap gap-2">
                {wa ? (
                  <Button asChild variant="secondary" icon={<WhatsAppIcon className="h-4 w-4" />}>
                    <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => r.estado === 'nueva' && change(r.id, 'contactada')}>
                      Escribirle
                    </a>
                  </Button>
                ) : null}
                {r.estado === 'nueva' || r.estado === 'contactada' ? (
                  <>
                    <Button onClick={() => change(r.id, 'aceptada')}>Aceptar</Button>
                    <Button variant="ghost" onClick={() => change(r.id, 'descartada')}>
                      Descartar
                    </Button>
                  </>
                ) : (
                  <>
                    {r.estado === 'aceptada' ? (
                      <Button asChild variant="secondary">
                        <Link to="/students?create=1">Crear alumno</Link>
                      </Button>
                    ) : null}
                    <Button variant="ghost" onClick={() => change(r.id, 'contactada')}>
                      Reabrir
                    </Button>
                  </>
                )}
              </div>
            </article>
          )
        })
      )}
    </div>
  )
}

// ───────────────────────── Página ─────────────────────────

export function MyMarketplacePage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = useAuthStore((s) => s.profile?.role === 'admin')
  const { data, isPending, isError, error, refetch } = useMyMarketplace(user?.id)
  const save = useSaveMyProfessional(user?.id)
  const [tab, setTab] = useState<Tab>('perfil')

  useEffect(() => {
    document.title = 'Mi página web · Haciéndolo Hábito'
  }, [])

  const professional = data?.professional ?? null
  const activePlans = useMemo(() => (data?.plans ?? []).filter((p) => p.activo).length, [data?.plans])
  const newRequests = (data?.requests ?? []).filter((r) => r.estado === 'nueva').length

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-14 pt-6 lg:px-10 lg:pt-9">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">Mi página web</h1>
          <p className="mt-1 text-body-sm text-ink-muted">Tu perfil público, tus planes y los clientes que te eligen desde la web.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <Button asChild variant="secondary">
              <Link to="/mi-pagina/profesionales">Aprobar profesionales</Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
            <a href="/profesionales" target="_blank" rel="noopener noreferrer">
              Ver el directorio
            </a>
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="h-64 animate-pulse rounded-xl bg-surface-elevated/60" aria-label="Cargando" />
      ) : isError ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-surface-border p-6">
          <p className="text-sm text-ink-secondary">{errorMessage(error).replace('No se pudo guardar.', 'No se pudo cargar tu página.')}</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {professional ? (
            <StatusBanner
              professional={professional}
              activePlans={activePlans}
              busy={save.isPending}
              onRequestPublish={() =>
                save.mutate(
                  {
                    id: professional.id,
                    input: {
                      slug: professional.slug,
                      nombre: professional.nombre,
                      rol: professional.rol,
                      deportes: professional.deportes,
                      especialidades: professional.especialidades,
                      foto_url: professional.foto_url,
                      bio: professional.bio,
                      ubicacion: professional.ubicacion,
                      modalidad: professional.modalidad,
                      whatsapp: professional.whatsapp,
                      estado: 'pendiente',
                    },
                  },
                  {
                    onSuccess: () => toast.success('Listo: el administrador ya puede aprobar tu página.'),
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                )
              }
            />
          ) : (
            <p className="rounded-xl bg-surface-elevated px-4 py-3 text-sm text-ink-secondary">
              <span className="font-semibold text-ink-primary">Todavía no tenés página.</span> Completá tu perfil y después cargá
              tus planes.
            </p>
          )}

          <SegmentedV2
            value={tab}
            onChange={setTab}
            options={[
              { value: 'perfil', label: 'Perfil' },
              { value: 'planes', label: 'Planes', count: data.plans.length },
              { value: 'solicitudes', label: 'Solicitudes', count: newRequests },
            ]}
          />

          {tab === 'perfil' ? (
            <ProfileForm key={professional?.id ?? 'new'} professional={professional} />
          ) : !professional ? (
            <p className="rounded-xl border border-dashed border-surface-inputBorder p-6 text-sm text-ink-muted">
              Primero creá tu perfil en la pestaña Perfil.
            </p>
          ) : tab === 'planes' ? (
            <PlansTab professional={professional} plans={data.plans} />
          ) : (
            <RequestsTab requests={data.requests} />
          )}
        </>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeft, Camera, Copy, ExternalLink, Plus, Trash2, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { SegmentedV2 } from '@/components/v2/ui'
import { ProfessionalPhoto } from '@/components/marketplace/PublicShell'
import {
  uploadMarketplacePhoto,
  useDeletePlan,
  useDeleteProfessional,
  useManagedProfessionals,
  useSavePlan,
  useSaveProfessional,
  useSetRequestStatus,
  type ManagedProfessional,
  type PlanInput,
} from '@/data/marketplace'
import {
  MARKETPLACE_DURATIONS,
  MARKETPLACE_ROLES,
  MARKETPLACE_SPORTS,
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
import { cn, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

type Tab = 'perfil' | 'planes' | 'solicitudes'

const MIGRATION = '20261112120000_marketplace_managed_profiles.sql'

const errorMessage = (err: unknown) => {
  const e = err as { code?: string; message?: string } | null
  if (e?.code === '23505') return 'Esa dirección ya la usa otro profesional. Probá con otra.'
  if (e?.code === '42P01' || e?.code === 'PGRST205') return 'Falta correr la migración del marketplace en Supabase.'
  if (e?.code === '23502' || e?.code === '42501' || e?.code === '42703') return `Falta correr ${MIGRATION} en Supabase.`
  if (e?.message && /imagen|JPG|MB/.test(e.message)) return e.message
  if (e?.message && /bucket/i.test(e.message)) return `Falta correr ${MIGRATION} en Supabase (crea el lugar para las fotos).`
  return 'No se pudo guardar. Revisá los datos y probá de nuevo.'
}

// ───────────────────────── Perfil ─────────────────────────

type ProfileDraft = {
  nombre: string
  slug: string
  slugTouched: boolean
  rol: MarketplaceRole
  deportes: string[]
  especialidades: string
  modalidad: MarketplaceModality[]
  ubicacion: string
  whatsapp: string
  bio: string
  fotoUrl: string | null
}

const draftKey = (id: string | null) => `hh-mkt-draft-${id ?? 'new'}`

function initialDraft(p: MarketplaceProfessional | null): ProfileDraft {
  return {
    nombre: p?.nombre ?? '',
    slug: p?.slug ?? '',
    slugTouched: Boolean(p),
    rol: p?.rol ?? 'entrenador',
    deportes: p?.deportes ?? [],
    especialidades: (p?.especialidades ?? []).join(', '),
    modalidad: p?.modalidad ?? ['online'],
    ubicacion: p?.ubicacion ?? '',
    whatsapp: p?.whatsapp ?? '',
    bio: p?.bio ?? '',
    fotoUrl: p?.foto_url ?? null,
  }
}

/** Lo que se venía escribiendo y no se guardó: sobrevive a cambiar de pestaña, de pantalla o recargar. */
function readDraft(id: string | null): ProfileDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(id))
    return raw ? (JSON.parse(raw) as ProfileDraft) : null
  } catch {
    return null
  }
}

function clearDraft(id: string | null) {
  try {
    sessionStorage.removeItem(draftKey(id))
  } catch {
    /* sin almacenamiento */
  }
}

function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-surface-border px-5 py-5 first:border-t-0 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <div>
        <h3 className="text-sm font-medium text-ink-primary">{title}</h3>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-ink-muted">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  )
}

function ProfileForm({ professional, onCreated }: { professional: MarketplaceProfessional | null; onCreated: (id: string) => void }) {
  const user = useAuthStore((s) => s.user)
  const save = useSaveProfessional()
  const id = professional?.id ?? null
  const [restored] = useState(() => readDraft(id))
  const [d, setD] = useState<ProfileDraft>(() => restored ?? initialDraft(professional))
  const [dirty, setDirty] = useState(Boolean(restored))
  const [errors, setErrors] = useState<Partial<Record<'nombre' | 'slug' | 'modalidad', string>>>({})
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<ProfileDraft>) => {
    setD((cur) => ({ ...cur, ...patch }))
    setDirty(true)
  }
  useEffect(() => {
    if (!dirty) return
    try {
      sessionStorage.setItem(draftKey(id), JSON.stringify(d))
    } catch {
      /* sin almacenamiento: queda en memoria */
    }
  }, [d, dirty, id])

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  async function onPickPhoto(file: File | undefined) {
    if (!file || !user) return
    setUploading(true)
    try {
      set({ fotoUrl: await uploadMarketplacePhoto(user.id, file) })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function discard() {
    clearDraft(id)
    setD(initialDraft(professional))
    setDirty(false)
    setErrors({})
  }

  function onSave() {
    const cleanSlug = marketplaceSlug(d.slug)
    const next: typeof errors = {}
    if (d.nombre.trim().length < 2) next.nombre = 'Escribí el nombre del profesional.'
    if (cleanSlug.length < 3) next.slug = 'La dirección necesita al menos 3 letras.'
    if (d.modalidad.length === 0) next.modalidad = 'Elegí al menos una modalidad.'
    setErrors(next)
    if (Object.keys(next).length) return

    save.mutate(
      {
        id,
        input: {
          slug: cleanSlug,
          nombre: d.nombre.trim(),
          rol: d.rol,
          deportes: d.deportes,
          especialidades: d.especialidades
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8),
          foto_url: d.fotoUrl,
          bio: d.bio.trim(),
          ubicacion: d.ubicacion.trim(),
          modalidad: d.modalidad,
          whatsapp: d.whatsapp.trim(),
        },
      },
      {
        onSuccess: (savedId) => {
          clearDraft(id)
          setDirty(false)
          setD((cur) => ({ ...cur, slug: cleanSlug, slugTouched: true }))
          toast.success(professional ? 'Perfil guardado' : 'Profesional creado. Ahora cargale los planes.')
          if (!professional) onCreated(savedId)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
      {restored && dirty ? (
        <p className="flex flex-wrap items-center justify-between gap-2 bg-status-warn/15 px-5 py-2.5 text-xs text-status-warn-ink">
          Recuperamos lo que venías escribiendo y no habías guardado.
          <Button variant="ghost" size="sm" onClick={discard}>
            Descartar
          </Button>
        </p>
      ) : null}

      <FormSection title="Quién es" hint="Lo primero que ve un cliente en el directorio: foto, nombre y a qué se dedica.">
        <div className="flex flex-wrap items-center gap-4">
          <ProfessionalPhoto nombre={d.nombre || 'HH'} fotoUrl={d.fotoUrl} className="h-20 w-20 text-2xl" />
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Elegir foto"
                onChange={(e) => void onPickPhoto(e.target.files?.[0])}
              />
              <Button variant="secondary" size="sm" icon={<Camera className="h-3.5 w-3.5" />} loading={uploading} onClick={() => fileRef.current?.click()}>
                {d.fotoUrl ? 'Cambiar foto' : 'Subir foto'}
              </Button>
              {d.fotoUrl ? (
                <Button variant="ghost" size="sm" onClick={() => set({ fotoUrl: null })}>
                  Quitar
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-ink-muted">JPG, PNG o WebP. Mejor cuadrada y de frente.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre y apellido"
            required
            value={d.nombre}
            onChange={(e) => set({ nombre: e.target.value, ...(d.slugTouched ? {} : { slug: marketplaceSlug(e.target.value) }) })}
            error={errors.nombre}
            maxLength={80}
          />
          <Select
            label="Qué hace"
            options={MARKETPLACE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
            value={d.rol}
            onChange={(e) => set({ rol: e.target.value as MarketplaceRole })}
          />
        </div>
        <Input
          label="Dirección de su página"
          required
          value={d.slug}
          onChange={(e) => set({ slugTouched: true, slug: e.target.value.toLowerCase() })}
          onBlur={() => set({ slug: marketplaceSlug(d.slug) })}
          error={errors.slug}
          hint={`${window.location.host}/p/${marketplaceSlug(d.slug) || 'nombre-apellido'}`}
          maxLength={60}
        />
      </FormSection>

      <FormSection title="Cómo trabaja" hint="El WhatsApp es a donde le llegan los clientes que lo eligen.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="WhatsApp"
            type="tel"
            inputMode="tel"
            value={d.whatsapp}
            onChange={(e) => set({ whatsapp: e.target.value })}
            hint="Con código de país, por ejemplo +54 11 5905 9170."
            maxLength={30}
          />
          <Input label="Ubicación" value={d.ubicacion} onChange={(e) => set({ ubicacion: e.target.value })} hint="Dónde atiende si es presencial." maxLength={80} />
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink-secondary">Modalidad</legend>
          <div className="flex flex-wrap gap-2">
            {(['online', 'presencial'] as const).map((m) => (
              <Button key={m} size="sm" variant={d.modalidad.includes(m) ? 'primary' : 'soft'} aria-pressed={d.modalidad.includes(m)} onClick={() => set({ modalidad: toggle(d.modalidad, m) })}>
                {m === 'online' ? 'Online' : 'Presencial'}
              </Button>
            ))}
          </div>
          {errors.modalidad ? (
            <p role="alert" className="mt-1.5 text-xs text-status-expired">
              {errors.modalidad}
            </p>
          ) : null}
        </fieldset>
      </FormSection>

      <FormSection title="Con quién trabaja" hint="Sirve para que lo encuentren al filtrar por deporte.">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink-secondary">Deportes</legend>
          <div className="flex flex-wrap gap-2">
            {MARKETPLACE_SPORTS.map((s) => {
              const on = d.deportes.includes(s.value)
              return (
                <Button key={s.value} variant={on ? 'primary' : 'soft'} size="sm" aria-pressed={on} onClick={() => set({ deportes: toggle(d.deportes, s.value).slice(0, 12) })}>
                  {s.label}
                </Button>
              )
            })}
          </div>
        </fieldset>
        <Input
          label="Especialidades"
          value={d.especialidades}
          onChange={(e) => set({ especialidades: e.target.value })}
          hint="Separadas por coma. La primera se muestra en su tarjeta."
        />
      </FormSection>

      <FormSection title="Presentación" hint="Unas líneas sobre quién es, con qué deportistas trabaja y cómo es su método.">
        <Textarea label="Sobre el profesional" rows={5} value={d.bio} onChange={(e) => set({ bio: e.target.value })} maxLength={1200} />
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-surface-border bg-surface-panel/60 px-5 py-3.5">
        <Button onClick={onSave} loading={save.isPending} disabled={uploading}>
          {professional ? 'Guardar perfil' : 'Crear profesional'}
        </Button>
        {dirty ? <span className="text-xs text-ink-muted">Hay cambios sin guardar.</span> : professional ? <span className="text-xs text-ink-muted">Todo guardado.</span> : null}
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

// ───────────────────────── Lista y editor ─────────────────────────

const STATE_CHIP: Record<MarketplaceProfessional['estado'], { label: string; className: string }> = {
  aprobado: { label: 'Publicado', className: 'bg-status-ok text-[rgb(36_53_11)]' },
  pendiente: { label: 'Sin publicar', className: 'bg-surface-elevated text-ink-secondary' },
  borrador: { label: 'Sin publicar', className: 'bg-surface-elevated text-ink-secondary' },
  oculto: { label: 'Oculto por el administrador', className: 'bg-status-expired/12 text-status-expired' },
}

function StateChip({ estado }: { estado: MarketplaceProfessional['estado'] }) {
  const s = STATE_CHIP[estado]
  return <span className={cn('inline-flex h-6 items-center rounded-md px-2 text-xs font-medium', s.className)}>{s.label}</span>
}

const roleLabel = (rol: MarketplaceRole) => MARKETPLACE_ROLES.find((r) => r.value === rol)?.label ?? rol

function ProfessionalCard({ p, onOpen }: { p: ManagedProfessional; onOpen: () => void }) {
  const active = p.plans.filter((x) => x.activo)
  const from = active.length ? Math.min(...active.map((x) => x.precio)) : null
  const fresh = p.requests.filter((r) => r.estado === 'nueva').length
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hh-focus group flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-card p-4 text-left transition-colors hover:border-ink-muted/40"
    >
      <div className="flex items-start gap-3">
        <ProfessionalPhoto nombre={p.nombre} fotoUrl={p.foto_url} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium tracking-[-0.01em] text-ink-primary">{p.nombre}</p>
          <p className="truncate text-xs text-ink-muted">{roleLabel(p.rol)}</p>
          <div className="mt-2">
            <StateChip estado={p.estado} />
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 border-t border-surface-border pt-3 text-xs">
        <div>
          <dt className="text-ink-muted">Planes</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink-primary">{active.length}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Desde</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink-primary">{from != null ? formatPrice(from) : '—'}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Solicitudes</dt>
          <dd className={cn('mt-0.5 text-sm font-medium tabular-nums', fresh ? 'text-status-expired' : 'text-ink-primary')}>
            {fresh ? `${fresh} ${fresh === 1 ? 'nueva' : 'nuevas'}` : p.requests.length}
          </dd>
        </div>
      </dl>
    </button>
  )
}

function Editor({ professional, onBack, onCreated }: { professional: ManagedProfessional | null; onBack: () => void; onCreated: (id: string) => void }) {
  const save = useSaveProfessional()
  const del = useDeleteProfessional()
  const [tab, setTab] = useState<Tab>('perfil')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const activePlans = professional?.plans.filter((p) => p.activo).length ?? 0
  const newRequests = professional?.requests.filter((r) => r.estado === 'nueva').length ?? 0
  const published = professional?.estado === 'aprobado'
  const url = professional ? `${window.location.origin}/p/${professional.slug}` : ''

  function setPublished(next: boolean) {
    if (!professional) return
    save.mutate(
      { id: professional.id, input: { estado: next ? 'aprobado' : 'borrador' } },
      {
        onSuccess: () => toast.success(next ? 'Publicado: ya aparece en el directorio.' : 'Ya no aparece en el directorio.'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onBack} className="-ml-2">
          Profesionales
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-surface-border bg-surface-card p-4">
        <ProfessionalPhoto nombre={professional?.nombre ?? 'HH'} fotoUrl={professional?.foto_url ?? null} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold tracking-tight text-ink-primary">{professional?.nombre ?? 'Nuevo profesional'}</h2>
          {professional ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <StateChip estado={professional.estado} />
              <span>{roleLabel(professional.rol)}</span>
            </div>
          ) : (
            <p className="mt-0.5 text-xs text-ink-muted">Cargá sus datos y guardá. Después le sumás los planes y lo publicás.</p>
          )}
        </div>
        {professional ? (
          <div className="flex flex-wrap items-center gap-2">
            {published ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Copy className="h-3.5 w-3.5" />}
                  onClick={() => {
                    void navigator.clipboard.writeText(url).then(
                      () => toast.success('Link copiado'),
                      () => toast.error('No se pudo copiar'),
                    )
                  }}
                >
                  Copiar link
                </Button>
                <Button asChild variant="secondary" size="sm" icon={<ExternalLink className="h-3.5 w-3.5" />}>
                  <a href={`/p/${professional.slug}`} target="_blank" rel="noopener noreferrer">
                    Ver página
                  </a>
                </Button>
                <Button variant="ghost" size="sm" loading={save.isPending} onClick={() => setPublished(false)}>
                  Dejar de publicar
                </Button>
              </>
            ) : professional.estado !== 'oculto' ? (
              <Button size="sm" loading={save.isPending} disabled={activePlans === 0} title={activePlans === 0 ? 'Cargale al menos un plan activo' : undefined} onClick={() => setPublished(true)}>
                Publicar
              </Button>
            ) : null}
            <Button variant="ghost" size="iconSm" aria-label="Eliminar profesional" title="Eliminar profesional" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      {professional && !published && professional.estado !== 'oculto' && activePlans === 0 ? (
        <p className="rounded-xl bg-surface-elevated px-4 py-3 text-sm text-ink-secondary">
          Para publicarlo falta cargarle al menos un plan activo, en la pestaña Planes.
        </p>
      ) : null}

      {professional ? (
        <SegmentedV2
          value={tab}
          onChange={setTab}
          options={[
            { value: 'perfil', label: 'Perfil' },
            { value: 'planes', label: 'Planes', count: professional.plans.length },
            { value: 'solicitudes', label: 'Solicitudes', count: newRequests },
          ]}
        />
      ) : null}

      {/* Las tres pestañas quedan montadas: cambiar de una a otra no borra lo que se estaba escribiendo. */}
      <div hidden={tab !== 'perfil'}>
        <ProfileForm key={professional?.id ?? 'new'} professional={professional} onCreated={onCreated} />
      </div>
      {professional ? (
        <>
          <div hidden={tab !== 'planes'}>
            <PlansTab professional={professional} plans={professional.plans} />
          </div>
          <div hidden={tab !== 'solicitudes'}>
            <RequestsTab requests={professional.requests} />
          </div>
        </>
      ) : null}

      {professional ? (
        <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminar profesional">
          <p className="text-sm text-ink-secondary">
            Se borran el perfil de <span className="font-medium text-ink-primary">{professional.nombre}</span>, sus planes y las solicitudes que recibió.
            No se puede deshacer.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() =>
                del.mutate(professional.id, {
                  onSuccess: () => {
                    clearDraft(professional.id)
                    toast.success('Profesional eliminado')
                    onBack()
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Eliminar
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

const SELECTED_KEY = 'hh-mkt-selected'

export function MyMarketplacePage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = useAuthStore((s) => s.profile?.role === 'admin')
  const { data, isPending, isError, error, refetch } = useManagedProfessionals(user?.id)
  // Qué se está editando (un id, 'new' o la lista). Se recuerda al salir y volver a la pantalla.
  const [selected, setSelectedState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SELECTED_KEY)
    } catch {
      return null
    }
  })
  const setSelected = (next: string | null) => {
    setSelectedState(next)
    try {
      if (next) sessionStorage.setItem(SELECTED_KEY, next)
      else sessionStorage.removeItem(SELECTED_KEY)
    } catch {
      /* sin almacenamiento */
    }
  }

  useEffect(() => {
    document.title = 'Marketplace · Haciéndolo Hábito'
  }, [])

  const professionals = data?.professionals ?? []
  const current = selected && selected !== 'new' ? (professionals.find((p) => p.id === selected) ?? null) : null
  const editing = selected === 'new' || Boolean(current)
  const pendingRequests = professionals.reduce((a, p) => a + p.requests.filter((r) => r.estado === 'nueva').length, 0)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-14 pt-6 lg:px-10 lg:pt-9">
      {editing ? null : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">Marketplace</h1>
            <p className="mt-1 max-w-xl text-body-sm text-ink-muted">
              Los profesionales que ofrecés en la web. Cargá a cada uno con sus planes y publicalo; los clientes que lo elijan te aparecen acá.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Button asChild variant="ghost">
                <Link to="/mi-pagina/profesionales">Ver todos (admin)</Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
              <a href="/profesionales" target="_blank" rel="noopener noreferrer">
                Ver el directorio
              </a>
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setSelected('new')} disabled={data?.needsMigration}>
              Nuevo profesional
            </Button>
          </div>
        </div>
      )}

      {data?.needsMigration ? (
        <p className="rounded-xl bg-status-warn/20 px-4 py-3 text-sm text-status-warn-ink">
          Para dar de alta a otros profesionales y subir fotos falta correr <span className="font-medium">{MIGRATION}</span> en Supabase.
        </p>
      ) : null}

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Cargando">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-elevated/60" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-surface-border p-6">
          <p className="text-sm text-ink-secondary">{errorMessage(error).replace('No se pudo guardar.', 'No se pudo cargar el marketplace.')}</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : editing ? (
        <Editor key={current?.id ?? 'new'} professional={current} onBack={() => setSelected(null)} onCreated={(id) => setSelected(id)} />
      ) : professionals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surface-inputBorder px-6 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-elevated text-ink-secondary">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink-primary">Todavía no cargaste profesionales</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">Sumá al primero: sus datos, una foto y los planes que ofrece. Cuando lo publiques aparece en la web.</p>
          </div>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setSelected('new')} disabled={data.needsMigration}>
            Nuevo profesional
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-muted">
            {professionals.length} {professionals.length === 1 ? 'profesional' : 'profesionales'} · {professionals.filter((p) => p.estado === 'aprobado').length} publicados
            {pendingRequests ? ` · ${pendingRequests} ${pendingRequests === 1 ? 'solicitud nueva' : 'solicitudes nuevas'}` : ''}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {professionals.map((p) => (
              <ProfessionalCard key={p.id} p={p} onOpen={() => setSelected(p.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

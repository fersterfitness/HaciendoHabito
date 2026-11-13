import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowUpRight, Camera, Check, ChevronDown, Copy, ExternalLink, Plus, Trash2, Users } from 'lucide-react'
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
  useGrantAccess,
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
  durationPer,
  formatPrice,
  hasPhoto,
  marketplaceSlug,
  modalityLabel,
  silhouetteOf,
  silhouetteValue,
  sportLabel,
  whatsappLink,
  type MarketplaceAccessState,
  type MarketplaceDuration,
  type MarketplaceModality,
  type MarketplacePlan,
  type MarketplaceProfessional,
  type MarketplaceRequest,
  type MarketplaceRequestStatus,
  type MarketplaceRole,
  type MarketplaceSilhouette,
} from '@/lib/marketplace'
import {
  ACCESS_LABEL,
  SELECTED_KEY,
  accessState,
  clearDraft,
  initialDraft,
  inviteMemo,
  readDraft,
  writeDraft,
  type ProfileDraft,
} from '@/lib/marketplaceDraft'
import { cn, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { AccessTab, ManagerChoice, grantBlocker, isEmail, type AccessContext } from './panel/AccessTab'

type Tab = 'perfil' | 'planes' | 'acceso' | 'solicitudes'

const MIGRATION = '20261112120000_marketplace_managed_profiles.sql'

const SILHOUETTES: { value: MarketplaceSilhouette; label: string }[] = [
  { value: 'neutra', label: 'Neutra' },
  { value: 'mujer', label: 'Mujer' },
  { value: 'hombre', label: 'Hombre' },
]

const errorMessage = (err: unknown) => {
  const e = err as { code?: string; message?: string } | null
  if (e?.code === '23505') return 'Esa dirección ya la usa otro profesional. Probá con otra.'
  if (e?.code === '42P01' || e?.code === 'PGRST205') return 'Falta correr la migración del marketplace en Supabase.'
  if (e?.code === '23502' || e?.code === '42501' || e?.code === '42703') return `Falta correr ${MIGRATION} en Supabase.`
  if (e?.code === '23514') {
    const m = e.message ?? ''
    if (/especialidades_len/.test(m)) return 'Cada especialidad puede tener hasta 40 letras. Acortá la más larga o separalas con comas.'
    if (/especialidades_count/.test(m)) return 'Se pueden cargar hasta 8 especialidades.'
    if (/deportes_len/.test(m)) return 'Cada deporte puede tener hasta 40 letras.'
    if (/deportes_count/.test(m)) return 'Se pueden elegir hasta 12 deportes.'
    if (/bio_len/.test(m)) return 'La presentación puede tener hasta 1.200 letras.'
    if (/ubicacion_len/.test(m)) return 'La ubicación puede tener hasta 80 letras.'
    if (/whatsapp_len/.test(m)) return 'El WhatsApp es demasiado largo: dejá solo el número.'
    if (/nombre_len/.test(m)) return 'El nombre tiene que tener entre 2 y 80 letras.'
    if (/slug_format/.test(m)) return 'La dirección solo puede tener letras, números y guiones (3 a 60).'
  }
  if (e?.message && /imagen|JPG|MB/.test(e.message)) return e.message
  if (e?.message && /bucket/i.test(e.message)) return `Falta correr ${MIGRATION} en Supabase (crea el lugar para las fotos).`
  return 'No se pudo guardar. Revisá los datos y probá de nuevo.'
}

// ───────────────────────── Perfil ─────────────────────────

function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-surface-border px-5 py-6 first:border-t-0 sm:px-6">
      <div>
        <h3 className="text-base font-semibold tracking-tight text-ink-primary">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** La tarjeta del directorio armada con lo que se está escribiendo, antes de guardar. */
function ProfilePreview({ d, from }: { d: ProfileDraft; from: number | null }) {
  const badge = d.especialidades.split(',').map((x) => x.trim()).find(Boolean) ?? (d.deportes[0] ? sportLabel(d.deportes[0]) : null)
  const mode = modalityLabel(d.modalidad)
  return (
    <aside className="hidden flex-col gap-2.5 lg:sticky lg:top-6 lg:flex" aria-label="Vista previa">
      <p className="text-xs font-medium text-ink-muted">Así se ve en la web</p>
      <div className="rounded-2xl bg-surface-elevated/70 p-3">
        <div className="flex flex-col gap-3.5 rounded-xl bg-surface-card p-4">
          <div className="flex items-center gap-3">
            <ProfessionalPhoto nombre={d.nombre || 'HH'} fotoUrl={d.fotoUrl} className="h-14 w-14 text-lg" />
            <div className="min-w-0">
              <p className={cn('truncate text-base font-semibold', !d.nombre && 'text-ink-muted')}>{d.nombre || 'Nombre y apellido'}</p>
              <p className="text-sm text-ink-secondary">{roleLabel(d.rol)}</p>
            </div>
          </div>
          {badge || mode ? (
            <div className="flex flex-wrap gap-1.5">
              {badge ? <span className="hh-pastel rounded-md bg-pastel-peach px-2 py-1 text-xs font-semibold text-pastel-peach-ink">{badge}</span> : null}
              {mode ? <span className="rounded-md bg-surface-elevated px-2 py-1 text-xs font-medium text-ink-secondary">{mode}</span> : null}
            </div>
          ) : null}
          {d.deportes.length ? <p className="line-clamp-1 text-xs text-ink-muted">{d.deportes.map(sportLabel).join(' · ')}</p> : null}
          <div className="flex items-end justify-between gap-3 border-t border-surface-border pt-3">
            <div className="flex flex-col">
              <span className="text-xs text-ink-muted">Desde</span>
              <span className={cn('text-lg font-bold tabular-nums', from == null && 'text-ink-muted')}>{from != null ? formatPrice(from) : '$ —'}</span>
            </div>
            <span className="rounded-lg bg-surface-elevated px-3 py-1.5 text-xs font-medium text-ink-primary">Ver planes</span>
          </div>
        </div>
        <p className={cn('mt-3 line-clamp-6 whitespace-pre-line px-1 pb-1 text-xs leading-relaxed', d.bio.trim() ? 'text-ink-secondary' : 'text-ink-muted')}>
          {d.bio.trim() || 'Acá va su presentación: quién es, con quién trabaja y cómo es su método.'}
        </p>
      </div>
      <p className="truncate px-1 text-xs text-ink-muted">
        {window.location.host}/p/{marketplaceSlug(d.slug) || 'nombre-apellido'}
      </p>
    </aside>
  )
}

function ProfileForm({
  professional,
  ctx,
  onCreated,
}: {
  professional: ManagedProfessional | null
  ctx: AccessContext
  onCreated: (id: string, next: Tab) => void
}) {
  const user = useAuthStore((s) => s.user)
  const activePrices = (professional?.plans ?? []).filter((x) => x.activo).map((x) => x.precio)
  const from = activePrices.length ? Math.min(...activePrices) : null
  const save = useSaveProfessional()
  const grant = useGrantAccess()
  const id = professional?.id ?? null
  const [restored] = useState(() => readDraft(id))
  const [d, setD] = useState<ProfileDraft>(() => restored ?? initialDraft(professional))
  const [dirty, setDirty] = useState(Boolean(restored))
  const [errors, setErrors] = useState<Partial<Record<'nombre' | 'slug' | 'modalidad' | 'email' | 'especialidades' | 'bio' | 'ubicacion' | 'whatsapp', string>>>({})
  const [newSport, setNewSport] = useState('')
  // Deportes que no están en la lista: los agrega el profesional y se guardan tal cual.
  const customSports = d.deportes.filter((v) => !MARKETPLACE_SPORTS.some((s) => s.value === v))
  function addSport() {
    const label = newSport.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!label) return
    const known = MARKETPLACE_SPORTS.find((s) => s.label.toLowerCase() === label.toLowerCase())
    const value = known?.value ?? label
    setNewSport('')
    if (d.deportes.some((v) => v.toLowerCase() === value.toLowerCase())) return
    if (d.deportes.length >= 12) return void toast.error('Se pueden elegir hasta 12 deportes.')
    set({ deportes: [...d.deportes, value] })
  }
  const [uploading, setUploading] = useState(false)
  const blocker = grantBlocker(ctx, d.rol)
  const wantsAccount = !professional && d.cuenta === 'propia' && !blocker
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<ProfileDraft>) => {
    setD((cur) => ({ ...cur, ...patch }))
    setDirty(true)
  }
  useEffect(() => {
    if (!dirty) return
    writeDraft(id, d)
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
    if (wantsAccount && !isEmail(d.email)) next.email = 'Escribí un correo válido: con ese correo va a entrar.'
    // Los mismos límites que tiene la base: se avisan acá, en el campo, en vez de fallar al guardar.
    const specialties = d.especialidades.split(',').map((x) => x.trim()).filter(Boolean)
    const tooLong = specialties.find((x) => x.length > 40)
    if (tooLong) next.especialidades = `«${tooLong.slice(0, 30)}…» tiene ${tooLong.length} letras y el máximo es 40. Acortala o separala con comas.`
    else if (specialties.length > 8) next.especialidades = `Cargaste ${specialties.length} especialidades y el máximo es 8.`
    if (d.bio.trim().length > 1200) next.bio = 'La presentación puede tener hasta 1.200 letras.'
    if (d.ubicacion.trim().length > 80) next.ubicacion = 'La ubicación puede tener hasta 80 letras.'
    if (d.whatsapp.trim().length > 30) next.whatsapp = 'Dejá solo el número, con código de país.'
    setErrors(next)
    if (Object.keys(next).length) toast.error('Hay datos para corregir: están marcados en el formulario.')
    if (Object.keys(next).length) return
    const inviteEmail = wantsAccount ? d.email.trim() : null

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
          if (professional) return void toast.success('Perfil guardado')
          if (!inviteEmail) {
            toast.success('Profesional creado. Ahora cargale los planes.')
            return onCreated(savedId, 'planes')
          }
          // Con cuenta propia: se crea en el mismo paso y se muestra el link para mandarle.
          grant.mutate(
            { professionalId: savedId, email: inviteEmail },
            {
              onSuccess: (res) => {
                inviteMemo.set(savedId, { link: res.link, email: res.email })
                toast.success(res.status === 'invited' ? 'Perfil y cuenta creados. Mandale la invitación.' : 'Perfil creado. Ese correo ya tenía cuenta: quedó vinculada.')
              },
              onError: (err) => {
                // El perfil quedó creado: en Acceso se reintenta con el correo ya escrito.
                inviteMemo.set(savedId, { link: null, email: inviteEmail })
                toast.error(err instanceof Error ? `El perfil se creó, pero la cuenta no. ${err.message}` : 'El perfil se creó, pero la cuenta no.')
              },
              onSettled: () => onCreated(savedId, 'acceso'),
            },
          )
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
      {restored && dirty ? (
        <p className="flex flex-wrap items-center justify-between gap-2 bg-status-warn/15 px-5 py-2.5 text-xs text-status-warn-ink">
          {d.postulacion
            ? `Cargamos lo que ${d.postulacion.split(' ')[0]} dejó en su postulación. Revisalo, completá lo que falta y creá el perfil.`
            : 'Recuperamos lo que venías escribiendo y no habías guardado.'}
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
                {hasPhoto(d.fotoUrl) ? 'Cambiar foto' : 'Subir foto'}
              </Button>
              {hasPhoto(d.fotoUrl) ? (
                <Button variant="ghost" size="sm" onClick={() => set({ fotoUrl: null })}>
                  Quitar
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-ink-muted">JPG, PNG o WebP. Mejor cuadrada y de frente.</p>
            {hasPhoto(d.fotoUrl) ? null : (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Silueta sin foto">
                <span className="text-xs text-ink-muted">Sin foto se ve una silueta:</span>
                {SILHOUETTES.map((s) => {
                  const on = silhouetteOf(d.fotoUrl) === s.value
                  return (
                    <Button key={s.value} variant={on ? 'primary' : 'secondary'} size="sm" aria-pressed={on} onClick={() => set({ fotoUrl: silhouetteValue(s.value) })}>
                      {s.label}
                    </Button>
                  )
                })}
              </div>
            )}
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
            {customSports.map((v) => (
              <Button key={v} variant="primary" size="sm" aria-pressed title="Quitar" onClick={() => set({ deportes: d.deportes.filter((x) => x !== v) })}>
                {v} ×
              </Button>
            ))}
          </div>
          <div className="mt-3 flex max-w-sm items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                label="¿No está en la lista?"
                placeholder="Por ejemplo: Handball"
                value={newSport}
                maxLength={40}
                onChange={(e) => setNewSport(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSport()
                  }
                }}
              />
            </div>
            <Button variant="secondary" disabled={!newSport.trim()} onClick={addSport}>
              Agregar
            </Button>
          </div>
        </fieldset>
        <Input
          label="Especialidades"
          value={d.especialidades}
          onChange={(e) => set({ especialidades: e.target.value })}
          error={errors.especialidades}
          hint="Separadas por coma, hasta 8 y de hasta 40 letras cada una. La primera se muestra en su tarjeta."
        />
      </FormSection>

      <FormSection title="Presentación" hint="Unas líneas sobre quién es, con qué deportistas trabaja y cómo es su método.">
        <Textarea label="Sobre el profesional" rows={5} value={d.bio} onChange={(e) => set({ bio: e.target.value })} maxLength={1200} />
      </FormSection>

      {professional ? null : (
        <FormSection title="Acceso a la app" hint="Aparecer en la web no necesita cuenta. Dásela si querés que use la app por su lado. Lo podés cambiar después.">
          <ManagerChoice value={blocker ? 'yo' : d.cuenta} onChange={(cuenta) => set({ cuenta })} blocker={blocker} />
          {wantsAccount ? (
            <Input
              label="Su correo"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="nombre@correo.com"
              value={d.email}
              onChange={(e) => set({ email: e.target.value })}
              error={errors.email}
              hint="Con este correo va a entrar. Al crear el perfil te damos un link para que elija su contraseña."
              maxLength={160}
            />
          ) : null}
        </FormSection>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-surface-border bg-surface-panel/60 px-5 py-3.5">
        <Button onClick={onSave} loading={save.isPending || grant.isPending} disabled={uploading}>
          {professional ? 'Guardar perfil' : wantsAccount ? 'Crear perfil y cuenta' : 'Crear profesional'}
        </Button>
        {dirty ? <span className="text-xs text-ink-muted">Hay cambios sin guardar.</span> : professional ? <span className="text-xs text-ink-muted">Todo guardado.</span> : null}
      </div>
    </div>
    <ProfilePreview d={d} from={from} />
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
      <p className="text-sm text-ink-secondary">Lo que cargues acá es lo que ven los clientes. Los cambios de precio se publican al guardar.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.id} className="flex flex-col gap-3.5 rounded-2xl border border-surface-border bg-surface-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold tracking-tight">{plan.titulo}</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {[
                    durationLabel(plan.duracion),
                    plan.modalidad === 'online' ? 'Online' : plan.modalidad === 'presencial' ? 'Presencial' : null,
                    plan.cupos == null ? 'sin límite de cupos' : `${plan.cupos} cupos`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <span className={cn('inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium', plan.activo ? 'bg-status-ok/15 text-status-ok-ink' : 'bg-surface-elevated text-ink-secondary')}>
                {plan.activo ? 'Activo' : 'Pausado'}
              </span>
            </div>
            <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', !plan.activo && 'text-ink-muted')}>
              {formatPrice(plan.precio)} <span className="text-xs font-normal tracking-normal text-ink-muted">{durationPer(plan.duracion)}</span>
            </p>
            {plan.incluye.length ? (
              <ul className="flex flex-col gap-1.5">
                {plan.incluye.slice(0, 4).map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-ink-secondary">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-ink-muted" aria-hidden="true" />
                    {item}
                  </li>
                ))}
                {plan.incluye.length > 4 ? <li className="pl-5 text-xs text-ink-muted">y {plan.incluye.length - 4} más</li> : null}
              </ul>
            ) : plan.descripcion ? (
              <p className="line-clamp-2 text-xs leading-relaxed text-ink-secondary">{plan.descripcion}</p>
            ) : null}
            <div className="mt-auto flex gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setEditing(plan)}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate(
                    { id: plan.id, professionalId: professional.id, input: { activo: !plan.activo } },
                    {
                      onSuccess: () => toast.success(plan.activo ? 'Plan pausado: ya no se muestra en la web' : 'Plan activado'),
                      onError: (err) => toast.error(errorMessage(err)),
                    },
                  )
                }
              >
                {plan.activo ? 'Pausar' : 'Activar'}
              </Button>
            </div>
          </article>
        ))}
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="hh-focus flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-surface-inputBorder p-5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-elevated/60 hover:text-ink-primary"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </span>
          {plans.length ? 'Sumar otro plan' : 'Cargar el primer plan'}
        </button>
      </div>
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

// ───────────────────────── Estado y pasos ─────────────────────────

const STATE_CHIP: Record<MarketplaceProfessional['estado'], { label: string; className: string }> = {
  aprobado: { label: 'Publicado', className: 'bg-status-ok text-[rgb(36_53_11)]' },
  pendiente: { label: 'Sin publicar', className: 'bg-surface-elevated text-ink-secondary' },
  borrador: { label: 'Sin publicar', className: 'bg-surface-elevated text-ink-secondary' },
  oculto: { label: 'Oculto por el administrador', className: 'bg-status-expired/12 text-status-expired' },
}

const chipClass = 'inline-flex h-6 items-center rounded-md px-2 text-xs font-medium'

function StateChip({ estado }: { estado: MarketplaceProfessional['estado'] }) {
  const s = STATE_CHIP[estado]
  return <span className={cn(chipClass, s.className)}>{s.label}</span>
}

const ACCESS_CHIP: Record<MarketplaceAccessState, string> = {
  'sin-cuenta': 'bg-surface-elevated text-ink-secondary',
  invitado: 'bg-status-warn/20 text-status-warn-ink',
  activa: 'bg-surface-elevated text-ink-primary',
  propia: 'bg-surface-elevated text-ink-primary',
}

function AccessChip({ state }: { state: MarketplaceAccessState }) {
  return <span className={cn(chipClass, ACCESS_CHIP[state])}>{ACCESS_LABEL[state]}</span>
}

const roleLabel = (rol: MarketplaceRole) => MARKETPLACE_ROLES.find((r) => r.value === rol)?.label ?? rol

type Step = { key: string; title: string; detail: string; status: 'done' | 'todo' | 'optional'; tab?: Tab }

/** Los cuatro pasos para que un profesional quede andando, con lo que falta en cada uno. */
function setupSteps(p: ManagedProfessional, myId: string | undefined): Step[] {
  const missing = [!hasPhoto(p.foto_url) && 'foto', !p.bio.trim() && 'presentación', !p.whatsapp.trim() && 'WhatsApp'].filter(Boolean) as string[]
  const active = p.plans.filter((x) => x.activo).length
  const access = accessState(p, myId)
  return [
    {
      key: 'perfil',
      title: 'Perfil',
      detail: missing.length ? `Falta ${missing.join(', ')}` : 'Completo',
      status: missing.length ? 'todo' : 'done',
      tab: 'perfil',
    },
    {
      key: 'planes',
      title: 'Planes',
      detail: active ? `${active} ${active === 1 ? 'activo' : 'activos'}` : 'Cargá al menos uno',
      status: active ? 'done' : 'todo',
      tab: 'planes',
    },
    {
      key: 'acceso',
      title: 'Acceso a la app',
      detail: ACCESS_LABEL[access],
      status: access === 'invitado' ? 'todo' : access === 'sin-cuenta' ? 'optional' : 'done',
      tab: 'acceso',
    },
    {
      key: 'publicar',
      title: 'En la web',
      detail: p.estado === 'aprobado' ? 'Publicado' : p.estado === 'oculto' ? 'Oculto' : active ? 'Listo para publicar' : 'Sin publicar',
      status: p.estado === 'aprobado' ? 'done' : 'todo',
    },
  ]
}

function StepDot({ status, n }: { status: Step['status']; n: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold',
        status === 'done' ? 'bg-status-ok text-[rgb(36_53_11)]' : status === 'optional' ? 'bg-surface-elevated text-ink-muted' : 'border border-surface-inputBorder text-ink-secondary',
      )}
    >
      {status === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
    </span>
  )
}

function SetupSteps({ steps, current, onGo }: { steps: Step[]; current: Tab; onGo: (tab: Tab) => void }) {
  return (
    <ol className="grid grid-cols-2 gap-1 sm:flex sm:items-center sm:gap-0">
      {steps.map((step, i) => {
        const on = Boolean(step.tab) && current === step.tab
        const body = (
          <>
            <StepDot status={step.status} n={i + 1} />
            <span className="min-w-0 text-left">
              <span className="block truncate text-body-sm font-medium text-ink-primary">{step.title}</span>
              <span className={cn('block truncate text-xs', step.status === 'todo' ? 'text-ink-secondary' : 'text-ink-muted')}>{step.detail}</span>
            </span>
          </>
        )
        const cell = 'flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2'
        return (
          <li key={step.key} className="flex min-w-0 items-center sm:flex-1 sm:last:flex-none">
            {step.tab ? (
              <button
                type="button"
                onClick={() => onGo(step.tab!)}
                aria-current={on ? 'step' : undefined}
                className={cn('hh-focus transition-colors hover:bg-surface-elevated', cell, on && 'bg-surface-elevated')}
              >
                {body}
              </button>
            ) : (
              <div className={cell}>{body}</div>
            )}
            {i < steps.length - 1 ? (
              <span aria-hidden="true" className={cn('mx-1 hidden h-px min-w-3 flex-1 sm:block', step.status === 'todo' ? 'bg-surface-border' : 'bg-ink-primary/40')} />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

const HOW_KEY = 'hh-mkt-howto'

const HOW_STEPS = [
  { title: 'Cargás el perfil', body: 'Foto, a qué se dedica y su WhatsApp. Es su página en la web.' },
  { title: 'Le sumás los planes', body: 'Qué ofrece y a qué precio. Es lo que el cliente agrega a su equipo.' },
  { title: 'Elegís quién lo maneja', body: 'Vos desde acá, o él con su propia cuenta de la app. Se la creás con su correo.' },
  { title: 'Lo publicás', body: 'Aparece en el directorio y las solicitudes llegan a quien lo maneja.' },
]

/** Explica el circuito completo. Se puede cerrar y queda cerrado. */
function HowItWorks({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(HOW_KEY)
      return saved ? saved === '1' : defaultOpen
    } catch {
      return defaultOpen
    }
  })
  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(HOW_KEY, next ? '1' : '0')
    } catch {
      /* sin almacenamiento */
    }
  }
  return (
    <section className="rounded-2xl bg-surface-elevated/70">
      <button type="button" onClick={toggle} aria-expanded={open} className="hh-focus flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left">
        <span className="text-body-sm font-medium text-ink-primary">Cómo funciona</span>
        <ChevronDown className={cn('h-4 w-4 text-ink-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open ? (
        <ol className="grid gap-2 px-2 pb-2 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-1.5 rounded-xl bg-surface-card p-3.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-primary text-2xs font-semibold text-surface-card">{i + 1}</span>
              <p className="text-sm font-medium text-ink-primary">{s.title}</p>
              <p className="text-xs leading-relaxed text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

// ───────────────────────── Lista y editor ─────────────────────────

function ProfessionalCard({ p, myId, onOpen }: { p: ManagedProfessional; myId: string | undefined; onOpen: () => void }) {
  const active = p.plans.filter((x) => x.activo)
  const from = active.length ? Math.min(...active.map((x) => x.precio)) : null
  const fresh = p.requests.filter((r) => r.estado === 'nueva').length
  const steps = setupSteps(p, myId)
  const next = steps.find((s) => s.status === 'todo')
  const ready = steps.filter((s) => s.status !== 'todo').length
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hh-focus group flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-card p-5 text-left transition-colors hover:bg-surface-elevated/40"
    >
      <div className="flex w-full items-center gap-3.5">
        <ProfessionalPhoto nombre={p.nombre} fotoUrl={p.foto_url} className="h-16 w-16 rounded-2xl text-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold tracking-tight text-ink-primary">{p.nombre}</p>
          <p className="truncate text-xs text-ink-muted">{roleLabel(p.rol)}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 self-start text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <StateChip estado={p.estado} />
        <AccessChip state={accessState(p, myId)} />
      </div>
      {next ? (
        <div className="flex w-full items-center gap-2.5">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={s.key} className={cn('h-1 flex-1 rounded-full', i < ready ? 'bg-ink-primary' : 'bg-surface-elevated')} />
            ))}
          </div>
          <span className="truncate text-xs text-ink-secondary">
            Sigue: {next.title.toLowerCase()}
          </span>
        </div>
      ) : null}
      <dl className="mt-auto grid w-full grid-cols-3 gap-2 border-t border-surface-border pt-3 text-xs">
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

function Editor({
  professional,
  ctx,
  initialTab,
  onBack,
  onCreated,
}: {
  professional: ManagedProfessional | null
  ctx: AccessContext
  initialTab: Tab
  /** Sin lista a la que volver (el profesional que solo ve su propio perfil). */
  onBack: (() => void) | null
  onCreated: (id: string, next: Tab) => void
}) {
  const save = useSaveProfessional()
  const del = useDeleteProfessional()
  const [tab, setTab] = useState<Tab>(professional ? initialTab : 'perfil')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const activePlans = professional?.plans.filter((p) => p.activo).length ?? 0
  const newRequests = professional?.requests.filter((r) => r.estado === 'nueva').length ?? 0
  const published = professional?.estado === 'aprobado'
  const url = professional ? `${window.location.origin}/p/${professional.slug}` : ''
  const canDelete = Boolean(professional && (professional.managed_by === ctx.myId || onBack))

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
    <div className="flex flex-col gap-4">
      {onBack ? (
        <div>
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onBack} className="-ml-2">
            Profesionales
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-2xl bg-surface-elevated/70 p-5">
        <ProfessionalPhoto nombre={professional?.nombre ?? 'HH'} fotoUrl={professional?.foto_url ?? null} className="h-20 w-20 rounded-2xl bg-surface-card text-2xl" />
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="truncate text-2xl font-semibold leading-tight tracking-tight text-ink-primary">{professional?.nombre ?? 'Nuevo profesional'}</h1>
          {professional ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
              <StateChip estado={professional.estado} />
              <AccessChip state={accessState(professional, ctx.myId)} />
              <span className="ml-1">{roleLabel(professional.rol)}</span>
            </div>
          ) : (
            <p className="mt-1 max-w-lg text-body-sm text-ink-muted">
              Cargá sus datos y elegí si lo manejás vos o si le das su propia cuenta. Después le sumás los planes y lo publicás.
            </p>
          )}
        </div>
        {professional ? (
          <div className="flex flex-wrap items-center gap-2">
            {published ? (
              <>
                <Button
                  variant="secondary"
                  icon={<Copy className="h-4 w-4" />}
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
                    Ver página
                  </a>
                </Button>
                <Button variant="ghost" loading={save.isPending} onClick={() => setPublished(false)}>
                  Dejar de publicar
                </Button>
              </>
            ) : professional.estado !== 'oculto' ? (
              <Button loading={save.isPending} disabled={activePlans === 0} title={activePlans === 0 ? 'Cargale al menos un plan activo' : undefined} onClick={() => setPublished(true)}>
                Publicar en la web
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="ghost" size="icon" aria-label="Eliminar profesional" title="Eliminar profesional" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {professional ? (
        <>
          <SetupSteps steps={setupSteps(professional, ctx.myId)} current={tab} onGo={setTab} />
          <SegmentedV2
            value={tab}
            onChange={setTab}
            options={[
              { value: 'perfil', label: 'Perfil' },
              { value: 'planes', label: 'Planes', count: professional.plans.length },
              { value: 'acceso', label: 'Acceso' },
              { value: 'solicitudes', label: 'Solicitudes', count: newRequests },
            ]}
          />
        </>
      ) : null}

      {/* Perfil, planes y solicitudes quedan montados: cambiar de pestaña no borra lo que se estaba escribiendo. */}
      <div hidden={tab !== 'perfil'}>
        <ProfileForm key={professional?.id ?? 'new'} professional={professional} ctx={ctx} onCreated={onCreated} />
      </div>
      {professional ? (
        <>
          <div hidden={tab !== 'planes'}>
            <PlansTab professional={professional} plans={professional.plans} />
          </div>
          <div hidden={tab !== 'acceso'}>
            <AccessTab professional={professional} ctx={ctx} />
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
            {professional.user_id && professional.user_id !== ctx.myId ? ' Su cuenta de la app no se borra: sigue entrando, sin página en la web.' : ''} No se puede deshacer.
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
                    inviteMemo.delete(professional.id)
                    toast.success('Profesional eliminado')
                    onBack?.()
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

// ───────────────────────── Página ─────────────────────────

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
  const [openTab, setOpenTab] = useState<Tab>('perfil')
  const setSelected = (next: string | null, tab: Tab = 'perfil') => {
    setSelectedState(next)
    setOpenTab(tab)
    try {
      if (next) sessionStorage.setItem(SELECTED_KEY, next)
      else sessionStorage.removeItem(SELECTED_KEY)
    } catch {
      /* sin almacenamiento */
    }
  }

  const professionals = data?.professionals ?? []
  const ctx: AccessContext = {
    myId: user?.id,
    canGrant: data?.canGrantAccess ?? false,
    needsAccessMigration: data?.needsAccessMigration ?? false,
  }
  // El profesional invitado: su único perfil es el propio y lo cargó otra cuenta. Entra directo a su página.
  const onlyMine = professionals.length === 1 && professionals[0].user_id === user?.id && professionals[0].managed_by !== user?.id ? professionals[0] : null
  const current = onlyMine ?? (selected && selected !== 'new' ? (professionals.find((p) => p.id === selected) ?? null) : null)
  const editing = Boolean(current) || (selected === 'new' && !onlyMine)
  const pendingRequests = professionals.reduce((a, p) => a + p.requests.filter((r) => r.estado === 'nueva').length, 0)
  const pendingInvites = professionals.filter((p) => accessState(p, user?.id) === 'invitado').length

  useEffect(() => {
    document.title = `${onlyMine ? 'Mi página' : 'Marketplace'} · Haciéndolo Hábito`
  }, [onlyMine])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-14 pt-6 lg:px-10 lg:pt-9">
      {editing ? null : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">Marketplace</h1>
            <p className="mt-1 max-w-xl text-body-sm text-ink-muted">
              Los profesionales que ofrecés en la web. Cada uno tiene su página y sus planes; vos decidís si lo manejás vos o si entra con su propia cuenta.
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
        <Editor
          key={current?.id ?? 'new'}
          professional={current}
          ctx={ctx}
          initialTab={openTab}
          onBack={onlyMine ? null : () => setSelected(null)}
          onCreated={(id, next) => setSelected(id, next)}
        />
      ) : (
        <>
          <HowItWorks defaultOpen={professionals.length < 2} />
          {professionals.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surface-inputBorder px-6 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-elevated text-ink-secondary">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-ink-primary">Todavía no cargaste profesionales</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">Sumá al primero: sus datos, una foto y los planes que ofrece. Si querés, le creás su cuenta en el mismo paso.</p>
              </div>
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setSelected('new')} disabled={data.needsMigration}>
                Nuevo profesional
              </Button>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {[
                  { label: 'Profesionales', value: professionals.length, tone: '' },
                  { label: 'Publicados en la web', value: professionals.filter((p) => p.estado === 'aprobado').length, tone: '' },
                  { label: 'Solicitudes nuevas', value: pendingRequests, tone: pendingRequests ? 'hh-pastel bg-pastel-peach text-pastel-peach-ink' : '' },
                  { label: 'Invitaciones sin usar', value: pendingInvites, tone: pendingInvites ? 'bg-status-warn/20 text-status-warn-ink' : '' },
                ].map((t) => (
                  <div key={t.label} className={cn('rounded-2xl px-4 py-3.5', t.tone || 'bg-surface-elevated/70 text-ink-primary')}>
                    <dt className={cn('text-xs', t.tone ? 'opacity-80' : 'text-ink-muted')}>{t.label}</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{t.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {professionals.map((p) => (
                  <ProfessionalCard key={p.id} p={p} myId={user?.id} onOpen={() => setSelected(p.id)} />
                ))}
                <button
                  type="button"
                  onClick={() => setSelected('new')}
                  disabled={data.needsMigration}
                  className="hh-focus flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-surface-inputBorder p-5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-elevated/60 hover:text-ink-primary disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </span>
                  Sumar un profesional
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

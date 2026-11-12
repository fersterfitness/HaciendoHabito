import { useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Copy, KeyRound, Mail, RefreshCw, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { useGrantAccess, type ManagedProfessional } from '@/data/marketplace'
import { MARKETPLACE_ROLES_WITH_APP, roleLabel, whatsappLink, type MarketplaceRole } from '@/lib/marketplace'
import { accessState, inviteMemo } from '@/lib/marketplaceDraft'
import { cn, formatDate } from '@/lib/utils'

export const ACCESS_MIGRATION = '20261113120000_marketplace_access.sql'

export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())

export type AccessContext = {
  myId: string | undefined
  /** Esta cuenta puede crearle una cuenta a otro. */
  canGrant: boolean
  needsAccessMigration: boolean
}

/** Por qué no se le puede dar cuenta propia (o null si se puede). */
export function grantBlocker(ctx: AccessContext, rol: MarketplaceRole): string | null {
  if (ctx.needsAccessMigration) return `Para crear cuentas falta correr ${ACCESS_MIGRATION} en Supabase.`
  if (!ctx.canGrant) return 'Solo el administrador puede crear cuentas para otros profesionales.'
  if (!MARKETPLACE_ROLES_WITH_APP.includes(rol)) return `Todavía no hay app para ${roleLabel(rol).toLowerCase()}: por ahora solo puede tener su página.`
  return null
}

const CHOICES = [
  {
    value: 'yo' as const,
    icon: UserCog,
    title: 'Lo manejo yo',
    body: 'No tiene cuenta. Vos editás su página y sus planes, y las solicitudes de sus clientes te llegan a vos.',
  },
  {
    value: 'propia' as const,
    icon: KeyRound,
    title: 'Tiene su propia cuenta',
    body: 'Entra a la app con su correo: carga sus alumnos y rutinas, edita su página y recibe sus solicitudes.',
  },
]

/** Las dos formas de manejar un perfil, como tarjetas para elegir. */
export function ManagerChoice({
  value,
  onChange,
  blocker,
}: {
  value: 'yo' | 'propia'
  onChange: (v: 'yo' | 'propia') => void
  blocker: string | null
}) {
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Quién maneja este perfil" className="grid gap-2.5 sm:grid-cols-2">
        {CHOICES.map((c) => {
          const on = value === c.value
          const disabled = c.value === 'propia' && Boolean(blocker)
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(c.value)}
              className={cn(
                'hh-focus flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                on ? 'border-ink-primary bg-surface-card' : 'border-surface-border bg-surface-card hover:border-surface-inputBorder',
                disabled && 'cursor-not-allowed opacity-55 hover:border-surface-border',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  on ? 'bg-ink-primary text-surface-card' : 'bg-surface-elevated text-ink-secondary',
                )}
              >
                <c.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink-primary">{c.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{c.body}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  on ? 'border-ink-primary bg-ink-primary text-surface-card' : 'border-surface-inputBorder',
                )}
              >
                {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
              </span>
            </button>
          )
        })}
      </div>
      {blocker ? <p className="text-xs text-ink-muted">{blocker}</p> : null}
    </div>
  )
}

function NextSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-2 rounded-xl bg-surface-elevated/70 p-3.5">
      {steps.map((s, i) => (
        <li key={s} className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-secondary">
          <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-card text-3xs font-semibold text-ink-primary">
            {i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  )
}

function InviteLink({ professional, link, email }: { professional: ManagedProfessional; link: string; email: string }) {
  const first = professional.nombre.split(' ')[0]
  const text = `Hola ${first}! Te creé tu cuenta en Haciéndolo Hábito. Abrí este link y elegí tu contraseña (sirve una sola vez y vence en una hora):\n${link}\n\nDespués entrás siempre con tu correo ${email}.`
  const wa = whatsappLink(professional.whatsapp, text)
  const copy = (value: string, ok: string) =>
    void navigator.clipboard.writeText(value).then(
      () => toast.success(ok),
      () => toast.error('No se pudo copiar'),
    )
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-status-ok/15 p-4">
      <div>
        <p className="text-sm font-medium text-ink-primary">Invitación lista para mandar</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
          Mandale este link. Lo abre, elige su contraseña y ya entra con {email}. Sirve una sola vez y vence en una hora.
        </p>
      </div>
      <p className="truncate rounded-lg bg-surface-card px-3 py-2 font-mono text-xs text-ink-secondary" title={link}>
        {link}
      </p>
      <div className="flex flex-wrap gap-2">
        {wa ? (
          <Button asChild icon={<WhatsAppIcon className="h-4 w-4" />}>
            <a href={wa} target="_blank" rel="noopener noreferrer">
              Enviar por WhatsApp
            </a>
          </Button>
        ) : null}
        <Button variant={wa ? 'secondary' : 'primary'} icon={<Copy className="h-4 w-4" />} onClick={() => copy(link, 'Link copiado')}>
          Copiar link
        </Button>
        <Button variant="ghost" onClick={() => copy(text, 'Mensaje copiado')}>
          Copiar mensaje
        </Button>
      </div>
      {wa ? null : <p className="text-xs text-ink-muted">Cargale el WhatsApp en Perfil para mandárselo con un toque.</p>}
    </div>
  )
}

function StatusRow({ icon: Icon, title, pill, pillClass, children }: { icon: typeof Mail; title: string; pill: string; pillClass: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-ink-secondary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-ink-primary">{title}</p>
          <span className={cn('inline-flex h-6 items-center rounded-md px-2 text-xs font-medium', pillClass)}>{pill}</span>
        </div>
        <div className="mt-1 text-xs leading-relaxed text-ink-muted">{children}</div>
      </div>
    </div>
  )
}

/** Pestaña «Acceso»: quién maneja el perfil y, si tiene cuenta propia, en qué quedó la invitación. */
export function AccessTab({ professional, ctx }: { professional: ManagedProfessional; ctx: AccessContext }) {
  const grant = useGrantAccess()
  const state = accessState(professional, ctx.myId)
  const memo = inviteMemo.get(professional.id)
  const [choice, setChoice] = useState<'yo' | 'propia'>(memo && !memo.link ? 'propia' : 'yo')
  const [email, setEmail] = useState(memo?.email ?? '')
  const [emailError, setEmailError] = useState<string>()
  // Fuerza a releer `inviteMemo` (vive fuera de React) después de generar un link.
  const [, bump] = useState(0)
  const blocker = grantBlocker(ctx, professional.rol)

  function run(withEmail?: string) {
    grant.mutate(
      { professionalId: professional.id, email: withEmail },
      {
        onSuccess: (res) => {
          inviteMemo.set(professional.id, { link: res.link, email: res.email })
          bump((n) => n + 1)
          toast.success(res.status === 'invited' ? 'Cuenta creada. Mandale la invitación.' : 'Ese correo ya tenía cuenta: quedó vinculada.')
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'No se pudo crear la cuenta.'),
      },
    )
  }

  function onCreate() {
    if (!isEmail(email)) return setEmailError('Escribí un correo válido: con ese correo va a entrar.')
    setEmailError(undefined)
    run(email.trim())
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-surface-border bg-surface-card p-5">
      {state === 'propia' ? (
        <StatusRow icon={UserCog} title="Este es tu perfil" pill="Tu cuenta" pillClass="bg-surface-elevated text-ink-secondary">
          Lo manejás con la cuenta con la que entraste. Las solicitudes de tus clientes te llegan acá, en Solicitudes.
        </StatusRow>
      ) : state === 'sin-cuenta' ? (
        <>
          <div>
            <h3 className="text-sm font-medium text-ink-primary">¿Quién maneja este perfil?</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Aparecer en la web no necesita cuenta. La cuenta es para que {professional.nombre.split(' ')[0]} use la app por su lado.
            </p>
          </div>
          <ManagerChoice value={choice} onChange={setChoice} blocker={blocker} />
          {choice === 'propia' && !blocker ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <Input
                  label="Su correo"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="nombre@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={emailError}
                  leftIcon={<Mail className="h-4 w-4" />}
                  maxLength={160}
                />
                <Button className="sm:mt-[1.375rem]" loading={grant.isPending} onClick={onCreate}>
                  Crear cuenta e invitar
                </Button>
              </div>
              <NextSteps
                steps={[
                  `Se crea una cuenta de ${roleLabel(professional.rol).toLowerCase()} con ese correo. No se le manda ningún mail.`,
                  'Te damos un link para que se lo pases por WhatsApp.',
                  'Lo abre, elige su contraseña y entra. Ve solo sus alumnos, no los tuyos.',
                ]}
              />
            </>
          ) : null}
        </>
      ) : state === 'invitado' ? (
        <>
          <StatusRow icon={Mail} title={professional.access?.email ?? ''} pill="Invitación sin usar" pillClass="bg-status-warn/20 text-status-warn-ink">
            Cuenta creada el {professional.access ? formatDate(professional.access.invited_at) : ''}. Todavía no eligió su contraseña.
          </StatusRow>
          {memo?.link ? (
            <InviteLink professional={professional} link={memo.link} email={memo.email} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-elevated/70 p-4">
              <p className="min-w-0 flex-1 basis-60 text-xs leading-relaxed text-ink-secondary">
                Por seguridad el link no queda guardado. Si no se lo mandaste, lo perdió o venció, generá uno nuevo: el anterior deja de servir.
              </p>
              <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={grant.isPending} onClick={() => run()}>
                Generar link nuevo
              </Button>
            </div>
          )}
        </>
      ) : (
        <StatusRow
          icon={KeyRound}
          title={professional.access?.email ?? 'Cuenta vinculada'}
          pill="Cuenta activa"
          pillClass="bg-status-ok/15 text-status-ok-ink"
        >
          {professional.access?.created_account === false
            ? 'Ese correo ya tenía cuenta en la app y quedó vinculada a este perfil. '
            : 'Entra con su correo y su contraseña. '}
          Edita su página y recibe sus solicitudes; vos lo seguís viendo acá. Si olvida la clave, la recupera con «Olvidé mi contraseña» en el ingreso.
        </StatusRow>
      )}
    </div>
  )
}

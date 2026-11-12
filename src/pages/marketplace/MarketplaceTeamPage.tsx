import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PublicShell, RoleIcon, RoleTile } from '@/components/marketplace/PublicShell'
import { submitTeamRequest, useTeamPlans } from '@/data/marketplace'
import { MARKETPLACE_ROLES, MARKETPLACE_SPORTS, ROLE_TONE, durationPer, formatPrice, roleArea, whatsappDigits } from '@/lib/marketplace'
import { cn } from '@/lib/utils'
import { useMarketplaceTeam, type TeamItem } from '@/stores/marketplaceTeam'

const SPORT_OPTIONS = [...MARKETPLACE_SPORTS.map((s) => ({ value: s.label, label: s.label })), { value: 'Otro', label: 'Otro' }]

type Errors = Partial<Record<'nombre' | 'whatsapp' | 'email', string>>

const NEXT_STEPS = [
  'Cada profesional recibe tu solicitud con tus datos.',
  'Te escriben por WhatsApp para coordinar el inicio y el pago.',
  'Acá no se cobra nada: el pago lo arreglás con cada uno.',
]

/** Dónde está el cliente en el recorrido: elegir, dejar sus datos, esperar el contacto. */
function Progress({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Elegís planes', 'Dejás tus datos', 'Te escriben']
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm" aria-label="Pasos">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < step
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                done ? 'bg-status-ok text-black' : n === step ? 'bg-ink-primary text-surface-base' : 'bg-surface-elevated text-ink-muted',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : n}
            </span>
            <span className={n === step ? 'font-semibold text-ink-primary' : 'text-ink-muted'}>{label}</span>
            {n < steps.length ? <span className="mx-1 hidden h-px w-6 bg-surface-inputBorder sm:block" aria-hidden="true" /> : null}
          </li>
        )
      })}
    </ol>
  )
}

export function MarketplaceTeamPage() {
  const items = useMarketplaceTeam((s) => s.items)
  const remove = useMarketplaceTeam((s) => s.remove)
  const clear = useMarketplaceTeam((s) => s.clear)

  const { data: livePlans, isSuccess } = useTeamPlans(items.map((i) => i.planId))
  // Con el precio de hoy: si el profesional lo cambió después de sumarlo, vale el actual.
  const rows = useMemo(
    () =>
      items.map((item) => {
        const live = livePlans?.find((p) => p.id === item.planId)
        return {
          item,
          precio: live?.precio ?? item.precio,
          titulo: live?.titulo ?? item.titulo,
          incluye: live?.incluye ?? [],
          unavailable: isSuccess && !live,
        }
      }),
    [items, livePlans, isSuccess],
  )
  const available = rows.filter((r) => !r.unavailable)
  const total = available.reduce((sum, r) => sum + r.precio, 0)
  const missingRoles = MARKETPLACE_ROLES.filter((r) => !items.some((i) => i.rol === r.value))

  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [deporte, setDeporte] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sent, setSent] = useState<TeamItem[] | null>(null)

  useEffect(() => {
    document.title = 'Tu equipo · Haciéndolo Hábito'
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    if (nombre.trim().length < 2) next.nombre = 'Escribí tu nombre y apellido.'
    const digits = whatsappDigits(whatsapp)
    if (!digits || digits.length > 15) next.whatsapp = 'Escribí tu WhatsApp con código de área, por ejemplo 11 5905 9170.'
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) next.email = 'Revisá el email.'
    setErrors(next)
    if (Object.keys(next).length || available.length === 0) return

    setSending(true)
    setSendError(null)
    try {
      await submitTeamRequest({
        planIds: available.map((r) => r.item.planId),
        nombre: nombre.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        deporte,
        objetivo: objetivo.trim(),
      })
      setSent(available.map((r) => r.item))
      clear()
    } catch {
      setSendError('No pudimos enviar la solicitud. Revisá tu conexión y probá de nuevo; tus datos siguen acá.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <PublicShell>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10 lg:py-14">
          <Progress step={3} />
          <div className="flex flex-col gap-4 rounded-2xl bg-surface-panel p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-ok text-black">
              <Check className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">Solicitud enviada</h1>
            <p className="text-base text-ink-secondary">
              {sent.length === 1
                ? `${sent[0]!.nombre} ya recibió tu pedido y te va a escribir por WhatsApp para coordinar el inicio y el pago.`
                : `Tus ${sent.length} profesionales ya recibieron tu pedido. Cada uno te va a escribir por WhatsApp para coordinar el inicio y el pago.`}
            </p>
            <ul className="flex w-full flex-col gap-2">
              {sent.map((i) => (
                <li key={i.professionalId} className="flex items-center gap-3 rounded-xl bg-surface-card p-3">
                  <RoleTile rol={i.rol} className="h-10 w-10" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-semibold">{i.nombre}</span>
                    <span className="truncate text-body-sm text-ink-muted">{i.titulo}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="secondary" size="lg" className="self-start">
              <Link to="/profesionales">Volver a profesionales</Link>
            </Button>
          </div>
        </main>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 lg:px-6 lg:py-10">
        <div className="flex flex-col gap-3">
          <Progress step={items.length === 0 ? 1 : 2} />
          <h1 className="text-4xl font-semibold leading-none tracking-tight lg:text-5xl">Tu equipo</h1>
          <p className="text-base text-ink-secondary">Un plan por cada profesional que elegiste. Podés cambiarlos antes de enviar.</p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-surface-inputBorder px-6 py-14 text-center">
            <div className="mb-2 flex gap-1.5" aria-hidden="true">
              {MARKETPLACE_ROLES.map((r) => (
                <span key={r.value} className={cn('hh-pastel flex h-10 w-10 items-center justify-center rounded-xl', ROLE_TONE[r.value])}>
                  <RoleIcon rol={r.value} className="h-5 w-5" />
                </span>
              ))}
            </div>
            <p className="text-lg font-semibold tracking-tight">Todavía no sumaste ningún plan</p>
            <p className="text-sm text-ink-muted">Buscá un profesional, elegí uno de sus planes y sumalo a tu equipo.</p>
            <Button asChild size="lg" className="mt-3">
              <Link to="/profesionales">Ver profesionales</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-3">
              {rows.map(({ item, precio, titulo, incluye, unavailable }) => (
                <article
                  key={item.professionalId}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-surface-border bg-surface-card p-4"
                >
                  <RoleTile rol={item.rol} className="h-14 w-14 rounded-2xl" iconClassName="h-6 w-6" />
                  <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                    <span className="text-xs font-medium text-ink-muted">
                      {roleArea(item.rol)} · {item.nombre}
                    </span>
                    <span className="text-lg font-semibold tracking-tight">{titulo}</span>
                    {incluye.length ? <span className="text-body-sm text-ink-secondary">{incluye.slice(0, 3).join(' · ')}</span> : null}
                    {unavailable ? (
                      <span className="text-sm font-medium text-status-expired">Este plan ya no está disponible. Quitalo o elegí otro.</span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 basis-40 items-center justify-between gap-3 sm:flex-none sm:basis-auto sm:flex-col sm:items-end sm:gap-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatPrice(precio)}</span>
                      <span className="text-xs text-ink-muted">{durationPer(item.duracion)}</span>
                    </span>
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/p/${item.slug}`}>Cambiar</Link>
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(item.professionalId)}>
                        Quitar
                      </Button>
                    </div>
                  </div>
                </article>
              ))}

              {missingRoles.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {missingRoles.map((r) => (
                    <Link
                      key={r.value}
                      to={`/profesionales?rol=${r.value}`}
                      className="flex min-h-14 items-center gap-3 rounded-xl border border-dashed border-surface-inputBorder px-3 py-2 text-ink-secondary transition-colors hover:bg-surface-panel hover:text-ink-primary"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
                        <RoleIcon rol={r.value} className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm font-medium">Sumar {r.label.toLowerCase()}</span>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              ) : null}

              <section className="mt-3 flex flex-col gap-4 rounded-2xl bg-surface-panel p-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold tracking-tight">Tus datos</h2>
                  <p className="text-sm text-ink-muted">Para que tus profesionales sepan a quién escribirle.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Nombre y apellido"
                    required
                    autoComplete="name"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    error={errors.nombre}
                    maxLength={80}
                    className="h-11"
                  />
                  <Input
                    label="WhatsApp"
                    required
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    error={errors.whatsapp}
                    hint="Por acá te van a escribir."
                    maxLength={30}
                    className="h-11"
                  />
                  <Input
                    label="Email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={errors.email}
                    maxLength={120}
                    className="h-11"
                  />
                  <Select
                    label="Tu deporte"
                    options={SPORT_OPTIONS}
                    placeholder="Elegí uno"
                    value={deporte}
                    onChange={(e) => setDeporte(e.target.value)}
                    className="h-11"
                  />
                </div>
                <Textarea
                  label="¿Qué querés lograr?"
                  rows={3}
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  maxLength={800}
                />
              </section>
            </div>

            <aside className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-card p-5 lg:sticky lg:top-20">
              <h2 className="text-base font-semibold tracking-tight">Resumen</h2>
              <div className="flex flex-col gap-2">
                {available.map(({ item, precio }) => (
                  <div key={item.professionalId} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink-secondary">{item.nombre}</span>
                    <span className="font-medium tabular-nums">{formatPrice(precio)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-surface-border pt-4">
                <span className="text-sm text-ink-secondary">Total</span>
                <span className="text-4xl font-semibold tabular-nums tracking-tight">{formatPrice(total)}</span>
              </div>
              <Button
                type="submit"
                size="lg"
                loading={sending}
                disabled={available.length === 0}
                className="w-full"
                icon={<ArrowRight className="h-4 w-4" />}
                iconPosition="right"
              >
                Enviar solicitud
              </Button>
              {sendError ? (
                <p role="alert" className="text-sm text-status-expired">
                  {sendError}
                </p>
              ) : null}
              <ol className="flex flex-col gap-2.5 rounded-xl bg-surface-panel p-3.5">
                {NEXT_STEPS.map((text, i) => (
                  <li key={text} className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-2xs font-semibold tabular-nums text-ink-secondary">
                      {i + 1}
                    </span>
                    {text}
                  </li>
                ))}
              </ol>
            </aside>
          </form>
        )}
      </main>
    </PublicShell>
  )
}

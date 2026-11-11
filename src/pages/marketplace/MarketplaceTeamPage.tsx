import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PublicShell } from '@/components/marketplace/PublicShell'
import { submitTeamRequest, useTeamPlans } from '@/data/marketplace'
import { MARKETPLACE_ROLES, MARKETPLACE_SPORTS, durationPer, formatPrice, roleArea, whatsappDigits } from '@/lib/marketplace'
import { getInitials } from '@/lib/utils'
import { useMarketplaceTeam, type TeamItem } from '@/stores/marketplaceTeam'

const SPORT_OPTIONS = [...MARKETPLACE_SPORTS.map((s) => ({ value: s.label, label: s.label })), { value: 'Otro', label: 'Otro' }]

type Errors = Partial<Record<'nombre' | 'whatsapp' | 'email', string>>

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
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-4 px-4 py-12">
          <CheckCircle2 className="h-10 w-10 text-status-ok-ink" aria-hidden="true" />
          <h1 className="text-3xl font-bold tracking-tight">Solicitud enviada</h1>
          <p className="text-base text-ink-secondary">
            {sent.length === 1
              ? `${sent[0]!.nombre} ya recibió tu pedido y te va a escribir por WhatsApp para coordinar el inicio y el pago.`
              : `Tus ${sent.length} profesionales ya recibieron tu pedido. Cada uno te va a escribir por WhatsApp para coordinar el inicio y el pago.`}
          </p>
          <ul className="flex w-full flex-col gap-2">
            {sent.map((i) => (
              <li key={i.professionalId} className="rounded-lg border border-surface-border p-3.5 text-sm">
                <span className="font-semibold">{i.nombre}</span>
                <span className="text-ink-secondary"> · {i.titulo}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant="secondary" size="lg">
            <Link to="/profesionales">Volver a profesionales</Link>
          </Button>
        </main>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">Tu equipo</h1>
          <p className="text-base text-ink-secondary">Un plan por cada profesional que elegiste. Podés cambiarlos antes de enviar.</p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-inputBorder p-8 text-center">
            <p className="text-base font-semibold">Todavía no sumaste ningún plan</p>
            <p className="mt-1 text-sm text-ink-muted">Buscá un profesional, elegí uno de sus planes y sumalo a tu equipo.</p>
            <Button asChild size="lg" className="mt-4">
              <Link to="/profesionales">Ver profesionales</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex flex-col gap-3.5">
              {rows.map(({ item, precio, titulo, incluye, unavailable }) => (
                <article key={item.professionalId} className="flex flex-wrap items-center gap-4 rounded-xl border border-surface-border p-4">
                  <div
                    aria-hidden="true"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-surface-elevated text-lg font-semibold text-ink-secondary"
                  >
                    {getInitials(item.nombre)}
                  </div>
                  <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{roleArea(item.rol)}</span>
                    <span className="text-base font-semibold">{titulo}</span>
                    <span className="text-sm text-ink-secondary">
                      {item.nombre}
                      {incluye.length ? ` · ${incluye.slice(0, 3).join(', ')}` : ''}
                    </span>
                    {unavailable ? (
                      <span className="text-sm font-medium text-status-expired">Este plan ya no está disponible. Quitalo o elegí otro.</span>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xl font-bold tabular-nums">
                      {formatPrice(precio)}
                      <span className="ml-1 text-xs font-normal text-ink-muted">{durationPer(item.duracion)}</span>
                    </span>
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="lg">
                        <Link to={`/p/${item.slug}`}>Cambiar plan</Link>
                      </Button>
                      <Button type="button" variant="ghost" size="lg" onClick={() => remove(item.professionalId)}>
                        Quitar
                      </Button>
                    </div>
                  </div>
                </article>
              ))}

              {missingRoles.length ? (
                <div className="flex flex-wrap gap-2">
                  {missingRoles.map((r) => (
                    <Button key={r.value} asChild variant="outline" size="lg" className="border-dashed">
                      <Link to={`/profesionales?rol=${r.value}`}>+ Sumar {r.label.toLowerCase()}</Link>
                    </Button>
                  ))}
                </div>
              ) : null}

              <section className="mt-2 flex flex-col gap-4 rounded-xl border border-surface-border p-5">
                <h2 className="text-lg font-semibold">Tus datos</h2>
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

            <aside className="flex flex-col gap-3.5 rounded-xl border border-surface-border bg-surface-panel p-5 lg:sticky lg:top-6">
              <h2 className="text-base font-semibold">Resumen</h2>
              {available.map(({ item, precio }) => (
                <div key={item.professionalId} className="flex justify-between gap-3 text-sm text-ink-secondary">
                  <span className="min-w-0">
                    {roleArea(item.rol)} · {item.nombre}
                  </span>
                  <span className="tabular-nums">{formatPrice(precio)}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 border-t border-surface-border pt-3.5">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-3xl font-bold tabular-nums">{formatPrice(total)}</span>
              </div>
              <Button type="submit" size="lg" loading={sending} disabled={available.length === 0} className="w-full">
                Enviar solicitud a mi equipo
              </Button>
              {sendError ? (
                <p role="alert" className="text-sm text-status-expired">
                  {sendError}
                </p>
              ) : null}
              <ol className="flex list-decimal flex-col gap-2 pl-4 text-body-sm text-ink-secondary">
                <li>Cada profesional recibe tu solicitud.</li>
                <li>Te escriben por WhatsApp para coordinar el inicio y el pago.</li>
                <li>No se cobra nada desde esta página.</li>
              </ol>
            </aside>
          </form>
        )}
      </main>
    </PublicShell>
  )
}

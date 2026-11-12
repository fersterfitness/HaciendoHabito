import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Globe, MessageCircle, Tag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PublicShell } from '@/components/marketplace/PublicShell'
import { submitApplication } from '@/data/marketplace'
import { MARKETPLACE_ROLES, whatsappDigits, type MarketplaceRole } from '@/lib/marketplace'
import { cn } from '@/lib/utils'

type Errors = Partial<Record<'nombre' | 'email' | 'whatsapp', string>>

const BENEFITS = [
  { icon: Globe, tone: 'bg-pastel-butter text-pastel-butter-ink', title: 'Tu página propia', text: 'Con tu foto, lo que hacés y un link para compartir.' },
  { icon: Tag, tone: 'bg-pastel-lavender text-pastel-lavender-ink', title: 'Tus planes y tus precios', text: 'Los cargás y los cambiás vos cuando quieras.' },
  { icon: MessageCircle, tone: 'bg-pastel-rose text-pastel-rose-ink', title: 'Solicitudes directas', text: 'Te llegan con los datos del deportista y coordinás por WhatsApp.' },
]

/** «Soy profesional»: quien todavía no tiene cuenta deja sus datos y el admin le crea el acceso. */
export function MarketplaceApplyPage() {
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<MarketplaceRole>('entrenador')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [deportes, setDeportes] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    document.title = 'Sumate como profesional · Haciéndolo Hábito'
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    if (nombre.trim().length < 2) next.nombre = 'Escribí tu nombre y apellido.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) next.email = 'Escribí un email válido: ahí te llega el acceso.'
    const digits = whatsappDigits(whatsapp)
    if (!digits || digits.length > 15) next.whatsapp = 'Escribí tu WhatsApp con código de área.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSending(true)
    setSendError(null)
    try {
      await submitApplication({
        nombre: nombre.trim(),
        rol,
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        deportes: deportes.trim(),
        mensaje: mensaje.trim(),
      })
      setSent(true)
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      setSendError(
        code === '23505'
          ? 'Ya recibimos una postulación con ese email. Te vamos a escribir pronto.'
          : 'No pudimos enviar tus datos. Revisá tu conexión y probá de nuevo.',
      )
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <PublicShell>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10 lg:py-14">
          <div className="flex flex-col items-start gap-4 rounded-2xl bg-surface-panel p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-ok text-black">
              <Check className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">Recibimos tus datos</h1>
            <p className="text-base text-ink-secondary">
              Te vamos a escribir por WhatsApp para darte tu acceso. Con tu cuenta vas a poder cargar tu perfil y tus planes.
            </p>
            <Button asChild variant="secondary" size="lg">
              <Link to="/profesionales">Ver profesionales</Link>
            </Button>
          </div>
        </main>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-8 px-4 py-10 lg:grid-cols-2 lg:gap-14 lg:px-6 lg:py-16">
        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-semibold leading-none tracking-tight lg:text-6xl">Sumate como profesional</h1>
            <p className="max-w-md text-base text-ink-secondary lg:text-lg">
              Mostrá tu trabajo a deportistas que están armando su equipo y recibí sus solicitudes.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {BENEFITS.map(({ icon: Icon, tone, title, text }) => (
              <li key={title} className="flex items-start gap-3 rounded-xl bg-surface-panel p-3.5">
                <span className={cn('hh-pastel flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="text-body-sm text-ink-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-muted">
            ¿Ya tenés cuenta?{' '}
            <Link to="/mi-pagina" className="font-semibold text-ink-primary underline underline-offset-2">
              Entrá a tu panel
            </Link>
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-card p-5 lg:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">Dejanos tus datos</h2>
            <p className="text-sm text-ink-muted">Te escribimos por WhatsApp y te damos tu acceso.</p>
          </div>
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
          <Select
            label="Qué hacés"
            required
            options={MARKETPLACE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
            value={rol}
            onChange={(e) => setRol(e.target.value as MarketplaceRole)}
            className="h-11"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email"
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              maxLength={120}
              className="h-11"
            />
            <Input
              label="WhatsApp"
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              error={errors.whatsapp}
              maxLength={30}
              className="h-11"
            />
          </div>
          <Input
            label="Deportes con los que trabajás"
            value={deportes}
            onChange={(e) => setDeportes(e.target.value)}
            hint="Por ejemplo: boxeo, running."
            maxLength={200}
            className="h-11"
          />
          <Textarea label="Contanos algo más" rows={3} value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={800} />
          <Button type="submit" size="lg" loading={sending} icon={<ArrowRight className="h-4 w-4" />} iconPosition="right">
            Quiero sumarme
          </Button>
          {sendError ? (
            <p role="alert" className="text-sm text-status-expired">
              {sendError}
            </p>
          ) : null}
        </form>
      </main>
    </PublicShell>
  )
}

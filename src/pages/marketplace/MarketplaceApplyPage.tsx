import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PublicShell } from '@/components/marketplace/PublicShell'
import { submitApplication } from '@/data/marketplace'
import { MARKETPLACE_ROLES, whatsappDigits, type MarketplaceRole } from '@/lib/marketplace'

type Errors = Partial<Record<'nombre' | 'email' | 'whatsapp', string>>

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

  return (
    <PublicShell>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
        {sent ? (
          <div className="flex flex-col items-start gap-4">
            <CheckCircle2 className="h-10 w-10 text-status-ok-ink" aria-hidden="true" />
            <h1 className="text-3xl font-bold tracking-tight">Recibimos tus datos</h1>
            <p className="text-base text-ink-secondary">
              Te vamos a escribir por WhatsApp para darte tu acceso. Con tu cuenta vas a poder cargar tu perfil y tus planes.
            </p>
            <Button asChild variant="secondary" size="lg">
              <Link to="/profesionales">Ver profesionales</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold leading-tight tracking-tight">Sumate como profesional</h1>
              <p className="text-base text-ink-secondary">
                Tenés tu propia página, cargás tus planes y tus precios, y recibís las solicitudes de los deportistas que te
                eligen.
              </p>
              <p className="text-sm text-ink-muted">
                ¿Ya tenés cuenta?{' '}
                <Link to="/mi-pagina" className="font-semibold text-brand-hover hover:underline">
                  Entrá a tu panel
                </Link>
              </p>
            </div>
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-xl border border-surface-border p-5">
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
              <Input
                label="Deportes con los que trabajás"
                value={deportes}
                onChange={(e) => setDeportes(e.target.value)}
                hint="Por ejemplo: boxeo, running."
                maxLength={200}
                className="h-11"
              />
              <Textarea label="Contanos algo más" rows={3} value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={800} />
              <Button type="submit" size="lg" loading={sending}>
                Quiero sumarme
              </Button>
              {sendError ? (
                <p role="alert" className="text-sm text-status-expired">
                  {sendError}
                </p>
              ) : null}
            </form>
          </>
        )}
      </main>
    </PublicShell>
  )
}

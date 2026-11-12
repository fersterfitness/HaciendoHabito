import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Eye, EyeOff, Lock } from 'lucide-react'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { supabase } from '@/lib/supabase'

/** El token viaja en el hash (`#token=…`): no llega a ningún servidor ni queda en los registros. */
function readInviteToken(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const token = params.get('token')
  return token && token.length >= 20 ? token : null
}

const STEPS = ['Elegís tu contraseña', 'Entrás con tu correo', 'Cargás tus alumnos y tu página']

/**
 * Invitación de un profesional: acá crea su contraseña y entra a la app.
 * El link recién se canjea al guardar, así que abrirlo (o la vista previa de WhatsApp) no lo gasta.
 */
export function WelcomePage() {
  const navigate = useAppNavigate()
  const [token] = useState(readInviteToken)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<'expired' | 'other' | null>(null)

  useEffect(() => {
    document.title = 'Tu cuenta · Haciéndolo Hábito'
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    const next: typeof errors = {}
    if (password.length < 8) next.password = 'Mínimo 8 caracteres.'
    if (confirm !== password) next.confirm = 'Las contraseñas no coinciden.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    setFailure(null)
    try {
      // Si el canje ya se hizo en un intento anterior (falló al guardar la clave), la sesión sigue abierta.
      const { data: current } = await supabase.auth.getSession()
      if (!current.session?.user.user_metadata?.hh_invited) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'magiclink' })
        if (error) {
          setFailure('expired')
          return
        }
      }
      const { error: passError } = await supabase.auth.updateUser({ password, data: { hh_invited: false } })
      if (passError) {
        setErrors({ password: /different|same/i.test(passError.message) ? 'Elegí una contraseña distinta.' : 'No se pudo guardar. Probá con otra contraseña.' })
        return
      }
      // Solo marca la invitación como usada; si falla no cambia nada para quien entra.
      await supabase.rpc('mark_marketplace_access_active')
      window.history.replaceState(null, '', window.location.pathname)
      navigate('/mi-pagina', { replace: true })
    } catch {
      setFailure('other')
    } finally {
      setSaving(false)
    }
  }

  const eye = (
    <button
      type="button"
      onClick={() => setShow((v) => !v)}
      className="text-ink-muted transition-colors hover:text-ink-primary"
      aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base p-4">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <div className="flex flex-col items-center gap-1">
          <BrandLogo size="md" />
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
          {!token || failure === 'expired' ? (
            <div className="flex flex-col gap-3">
              <h1 className="text-lg font-semibold tracking-tight text-ink-primary">
                {token ? 'Este link ya no sirve' : 'El link está incompleto'}
              </h1>
              <p className="text-sm leading-relaxed text-ink-secondary">
                {token
                  ? 'Venció o ya se usó. Pedile a quien te invitó que te mande uno nuevo: se genera en un toque.'
                  : 'Abrilo de nuevo desde el mensaje que te mandaron, sin recortarlo.'}
              </p>
              <p className="text-sm text-ink-muted">
                ¿Ya creaste tu contraseña?{' '}
                <Link to="/login" className="font-medium text-ink-primary underline underline-offset-2">
                  Entrá acá
                </Link>
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-ink-primary">Te sumaron a Haciéndolo Hábito</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                Creá tu contraseña y ya tenés tu propia cuenta de profesional.
              </p>

              <ol className="my-5 flex flex-col gap-2">
                {STEPS.map((step, i) => (
                  <li key={step} className="flex items-center gap-2.5 text-sm text-ink-secondary">
                    <span
                      className={
                        i === 0
                          ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-primary text-2xs font-semibold text-surface-card'
                          : 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-2xs font-medium text-ink-muted'
                      }
                    >
                      {i + 1}
                    </span>
                    <span className={i === 0 ? 'font-medium text-ink-primary' : undefined}>{step}</span>
                  </li>
                ))}
              </ol>

              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
                <Input
                  label="Contraseña"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIconInteractive
                  rightIcon={eye}
                  error={errors.password}
                  hint="Mínimo 8 caracteres."
                />
                <Input
                  label="Repetila"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  leftIcon={<Check className="h-4 w-4" />}
                  error={errors.confirm}
                />
                <Button type="submit" size="lg" loading={saving} icon={<ArrowRight className="h-4 w-4" />} iconPosition="right" className="w-full">
                  Crear mi cuenta
                </Button>
                {failure === 'other' ? (
                  <p role="alert" className="text-sm text-status-expired">
                    No pudimos conectar. Revisá tu conexión y probá de nuevo.
                  </p>
                ) : null}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

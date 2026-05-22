import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft, Eye, EyeOff, Lock, ShieldCheck, AlertCircle } from 'lucide-react'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { supabase } from '@/lib/supabase'
import {
  isPasswordRecoveryHash,
  isPasswordRecoveryPending,
  setPasswordRecoveryPending,
} from '@/lib/authRecovery'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'

const resetSchema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string().min(8, 'Mínimo 8 caracteres'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  })

type ResetForm = z.infer<typeof resetSchema>

function parseHashAuthError(): string | null {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return null
  const params = new URLSearchParams(raw)
  if (!params.get('error')) return null
  const code = params.get('error_code')
  if (code === 'otp_expired') {
    return 'El enlace venció o ya se usó. Pedí uno nuevo desde el login.'
  }
  return params.get('error_description')?.replace(/\+/g, ' ') ?? 'No se pudo validar el enlace.'
}

export function ResetPasswordPage() {
  const navigate = useAppNavigate()
  const [hashError, setHashError] = useState<string | null>(null)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) })

  useEffect(() => {
    const err = parseHashAuthError()
    if (err) {
      setHashError(err)
      setChecking(false)
      return
    }

    let mounted = true

    const markRecoveryReady = () => {
      if (!mounted) return
      setPasswordRecoveryPending(true)
      setRecoveryReady(true)
      setChecking(false)
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' && session) {
        markRecoveryReady()
      }
    })

    void (async () => {
      await new Promise((r) => setTimeout(r, 0))
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return

      if (session && (isPasswordRecoveryHash() || isPasswordRecoveryPending())) {
        markRecoveryReady()
        return
      }

      setChecking(false)
    })()

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(data: ResetForm) {
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      toast.error(error.message, { position: 'bottom-center' })
      return
    }
    setPasswordRecoveryPending(false)
    toast.success('Contraseña actualizada. Iniciá sesión.', { position: 'bottom-center' })
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const subtitle = checking
    ? 'Verificando enlace…'
    : hashError
      ? 'Enlace inválido'
      : recoveryReady
        ? 'Elegí tu nueva clave'
        : 'Recuperar acceso'

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4 pt-16 sm:pt-4">
      <div className="flex w-full max-w-sm flex-col items-stretch">
        <div className="mb-2 flex w-full flex-col items-center gap-1">
          <BrandLogo size="lg" />
          <p className="text-center text-sm text-ink-secondary">{subtitle}</p>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-card dark:shadow-none">
          <Link
            to="/login?forgot=1"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary transition-colors -mt-1 mb-5"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Volver al login
          </Link>

          {checking ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner size="lg" accent="trainerCta" />
              <p className="text-sm text-ink-secondary">Validando el enlace del mail…</p>
            </div>
          ) : hashError ? (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-status-expired/10 text-status-expired"
                aria-hidden
              >
                <AlertCircle className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-ink-primary">No pudimos usar este enlace</h2>
                <p className="text-sm text-status-expired leading-relaxed max-w-[18rem]" role="alert">
                  {hashError}
                </p>
              </div>
              <Link
                to="/login?forgot=1"
                className="w-full inline-flex items-center justify-center rounded-xl border border-surface-border/80 bg-surface-card px-4 py-2.5 text-sm font-medium text-ink-primary hover:bg-surface-elevated/50 transition-colors"
              >
                Pedir un enlace nuevo
              </Link>
            </div>
          ) : !recoveryReady ? (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated text-ink-muted"
                aria-hidden
              >
                <Lock className="h-7 w-7" />
              </div>
              <p className="text-sm text-ink-secondary leading-relaxed max-w-[18rem]">
                Abrí el enlace del correo en esta misma pestaña, con la app abierta.
              </p>
              <Link
                to="/login?forgot=1"
                className="w-full inline-flex items-center justify-center rounded-xl border border-surface-border/80 bg-surface-card px-4 py-2.5 text-sm font-medium text-ink-primary hover:bg-surface-elevated/50 transition-colors"
              >
                Ir a recuperar contraseña
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center gap-3 pb-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary"
                  aria-hidden
                >
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-ink-primary">Nueva contraseña</h2>
                  <p className="text-xs text-ink-muted leading-relaxed px-1">
                    La sesión del mail es temporal. Al guardar, volverás a iniciar sesión con la clave nueva.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Nueva contraseña"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIconInteractive
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-ink-muted hover:text-ink-primary transition-colors"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  error={errors.password?.message}
                  {...register('password')}
                />
                <Input
                  label="Confirmar contraseña"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIconInteractive
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="text-ink-muted hover:text-ink-primary transition-colors"
                      aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  error={errors.confirm?.message}
                  {...register('confirm')}
                />
                <Button
                  type="submit"
                  className="w-full bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-none"
                  loading={isSubmitting}
                  icon={<ArrowRight className="h-4 w-4" />}
                  iconPosition="right"
                >
                  Guardar contraseña
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

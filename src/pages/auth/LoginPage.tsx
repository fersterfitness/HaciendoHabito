import { useState, useEffect } from 'react'
import { Navigate, Link, useSearchParams } from 'react-router-dom'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff, KeyRound, CheckCircle2, Inbox } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemeToggleMoonIcon, ThemeToggleSunIcon } from '@/components/ui/ThemeToggleIcons'
import { getAuthRedirectUrl } from '@/lib/authRedirect'
import { isPasswordRecoveryPending, setPasswordRecoveryPending } from '@/lib/authRecovery'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
})

type LoginForm = z.infer<typeof loginSchema>
type ForgotForm = z.infer<typeof forgotSchema>

export function LoginPage() {
  const { user } = useAuth()
  const navigate = useAppNavigate()
  const { theme, toggleTheme } = useTheme()
  const [searchParams] = useSearchParams()
  const [forgotMode, setForgotMode] = useState(searchParams.get('forgot') === '1')
  const [showPassword, setShowPassword] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const {
    register: registerForgot,
    handleSubmit: handleForgotSubmit,
    formState: { errors: forgotErrors, isSubmitting: forgotSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) })

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (isPasswordRecoveryPending() && !session) {
        setPasswordRecoveryPending(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!user) return
    if (isPasswordRecoveryPending()) {
      navigate('/reset-password', { replace: true })
      return
    }
    navigate('/dashboard', { replace: true })
  }, [user, navigate])

  if (user) {
    if (isPasswordRecoveryPending()) return <Navigate to="/reset-password" replace />
    return <Navigate to="/dashboard" replace />
  }

  async function onSubmit(data: LoginForm) {
    const email = data.email.trim().toLowerCase()
    await supabase.auth.signOut({ scope: 'local' })
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: data.password,
    })
    if (error) {
      if (import.meta.env.DEV) {
        console.error('[login] signInWithPassword', error.message, error)
      }
      toast.error(
        error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : error.message,
        { position: 'bottom-center' },
      )
    }
  }

  async function onForgotSubmit(data: ForgotForm) {
    const email = data.email.trim().toLowerCase()
    const redirectTo = getAuthRedirectUrl()
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      toast.error(error.message, { position: 'bottom-center' })
      return
    }
    setForgotSent(true)
  }

  const formTitle = forgotMode
    ? forgotSent
      ? 'Revisá tu correo'
      : 'Recuperar contraseña'
    : 'Bienvenido de vuelta'

  const formSubtitle = forgotMode
    ? forgotSent
      ? 'Si el email está registrado, te enviamos un enlace para elegir una contraseña nueva.'
      : 'Ingresá tu email y te mandamos un enlace seguro para restablecerla.'
    : 'Accedé a tu panel de entrenamiento y nutrición.'

  return (
    <div className="relative min-h-screen bg-surface-base lg:grid lg:grid-cols-2">
      {/* Ambient blur (mobile + full page) */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden"
        aria-hidden
      >
        <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-brand-secondary/20 blur-3xl" />
        <div className="absolute -right-10 top-1/3 h-48 w-48 rounded-full bg-brand-tertiary/15 blur-3xl" />
      </div>

      {/* Brand panel — desktop */}
      <aside
        className={cn(
          'relative hidden lg:flex flex-col justify-between overflow-hidden',
          'border-r border-brand-secondary/15',
          'bg-gradient-to-br from-brand-secondary/[0.18] via-brand-secondary/[0.06] to-surface-base',
        )}
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-secondary/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/4 h-64 w-64 rounded-full bg-brand-tertiary/20 blur-3xl"
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-12 py-16">
          <BrandLogo size="lg" className="max-w-[min(14rem,40vw)]" />
          <div className="max-w-sm space-y-3 text-center">
            <p className="text-lg font-semibold tracking-tight text-ink-primary">
              Haciéndolo Hábito
            </p>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Entrená, comé mejor y seguí el progreso de tus pacientes en un solo lugar.
            </p>
          </div>
        </div>

        <p className="relative z-10 px-12 pb-8 text-center text-xs text-ink-muted">
          fitness · hábitos · progreso · {new Date().getFullYear()}
        </p>
      </aside>

      {/* Form column */}
      <div
        className={cn(
          'relative flex min-h-dvh flex-col lg:min-h-screen lg:items-center lg:justify-center lg:p-8',
          'bg-gradient-to-b from-brand-secondary/[0.12] via-surface-base to-surface-base lg:bg-none',
        )}
      >
        {/* Toolbar */}
        <header
          className={cn(
            'relative z-10 flex shrink-0 items-center justify-end gap-2 px-4 pb-2',
            'pt-[max(0.75rem,env(safe-area-inset-top))]',
            'lg:absolute lg:inset-x-auto lg:right-6 lg:top-6 lg:left-auto lg:px-0 lg:pb-0 lg:pt-0',
          )}
        >
          <div className="flex items-center gap-2">
            <Link
              to="/form"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border border-surface-border/80',
                'bg-surface-card/70 px-3 py-2 text-xs font-medium text-ink-secondary backdrop-blur-sm',
                'transition-colors hover:border-brand-secondary/40 hover:text-brand-secondary',
              )}
            >
              Inscripción
              <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                'rounded-xl border border-surface-border/80 bg-surface-card/70 p-2',
                'text-ink-muted backdrop-blur-sm transition-colors',
                'hover:border-brand-secondary/40 hover:text-ink-primary',
              )}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? <ThemeToggleSunIcon /> : <ThemeToggleMoonIcon />}
            </button>
          </div>
        </header>

        <main className="relative z-10 flex flex-1 flex-col justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 lg:flex-none lg:w-full lg:max-w-sm lg:px-0 lg:pb-0">
          <div className="w-full lg:mx-auto">
            <div className="mb-5 flex justify-center lg:hidden">
              <BrandLogo size="lg" className="max-h-[min(11rem,28svh)] w-auto" />
            </div>

            <div className="mb-6 hidden space-y-1 lg:block">
              <h1 className="text-xl font-semibold tracking-tight text-ink-primary">{formTitle}</h1>
              <p className="text-sm leading-relaxed text-ink-secondary">{formSubtitle}</p>
            </div>

          <div
            className={cn(
              'space-y-4 p-0',
              'sm:space-y-0 sm:rounded-2xl sm:border sm:border-brand-secondary/20 sm:bg-surface-card/90 sm:p-6 sm:shadow-card sm:backdrop-blur-md',
              'dark:sm:border-brand-secondary/25 dark:sm:bg-surface-card/95 dark:sm:shadow-none',
            )}
          >

            {forgotMode ? (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false)
                    setForgotSent(false)
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-brand-secondary"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Volver al login
                </button>

                {forgotSent ? (
                  <div className="flex flex-col items-center gap-4 py-1 text-center">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-status-generated/15 text-status-generated"
                      aria-hidden
                    >
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <div className="flex w-full items-start gap-2.5 rounded-xl border border-surface-border bg-surface-elevated/60 px-3.5 py-3 text-left">
                      <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                      <p className="text-xs leading-relaxed text-ink-secondary">
                        Mirá también la carpeta de{' '}
                        <span className="font-medium text-ink-primary">spam</span>. El enlace vence en
                        aproximadamente una hora; pedí otro si expiró.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="gradientPrimary"
                      className="w-full !h-12 sm:!h-11"
                      onClick={() => {
                        setForgotMode(false)
                        setForgotSent(false)
                      }}
                    >
                      Listo, volver a ingresar
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center gap-3 pb-1 text-center">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-secondary/15 text-brand-secondary"
                        aria-hidden
                      >
                        <KeyRound className="h-7 w-7" />
                      </div>
                    </div>

                    <form onSubmit={handleForgotSubmit(onForgotSubmit)} className="space-y-4">
                      <Input
                        label="Email de tu cuenta"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@email.com"
                        leftIcon={<Mail className="h-4 w-4" />}
                        error={forgotErrors.email?.message}
                        {...registerForgot('email')}
                      />
                    <Button
                      type="submit"
                      variant="gradientPrimary"
                      className="w-full !h-12 sm:!h-11"
                      loading={forgotSubmitting}
                      icon={<Mail className="h-4 w-4" />}
                      iconPosition="right"
                    >
                      Enviar enlace de recuperación
                    </Button>
                    </form>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  leftIcon={<Mail className="h-4 w-4" />}
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIconInteractive
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-ink-muted transition-colors hover:text-brand-secondary"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  error={errors.password?.message}
                  {...register('password')}
                />
                <div className="-mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true)
                      setForgotSent(false)
                    }}
                    className="text-xs font-medium text-ink-secondary transition-colors hover:text-brand-secondary"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <Button
                  type="submit"
                  variant="gradientPrimary"
                  className="w-full !h-12 sm:!h-11"
                  loading={isSubmitting}
                  icon={<ArrowRight className="h-4 w-4" />}
                  iconPosition="right"
                >
                  Ingresar
                </Button>
              </form>
            )}
          </div>

          <p className="mt-4 text-center text-[10px] text-ink-muted/80 lg:hidden">
            {new Date().getFullYear()}
          </p>
          </div>
        </main>
      </div>
    </div>
  )
}

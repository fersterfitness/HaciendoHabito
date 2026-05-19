import { useState, useEffect } from 'react'
import { Navigate, Link, useSearchParams } from 'react-router-dom'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Mail, Lock, ArrowRight, ArrowLeft, Zap, Eye, EyeOff, KeyRound, CheckCircle2, Inbox } from 'lucide-react'
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
  const [tab, setTab] = useState<'password' | 'magic'>('password')
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
    // Sesión local corrupta o a medias (recovery) compite por el lock de Supabase y falla el login en dev.
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
      )
    }
  }

  async function onForgotSubmit(data: ForgotForm) {
    const email = data.email.trim().toLowerCase()
    const redirectTo = getAuthRedirectUrl()
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      toast.error(error.message)
      return
    }
    setForgotSent(true)
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4 pt-16 sm:pt-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <Link
          to="/form"
          className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary hover:border-brand-primary/40 transition-colors shadow-sm"
        >
          Inscripción
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-surface-card border border-surface-border transition-all"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <ThemeToggleSunIcon /> : <ThemeToggleMoonIcon />}
        </button>
      </div>

      <div className="flex w-full max-w-sm flex-col items-stretch">
        <div className="mb-2 flex w-full flex-col items-center gap-1 px-px">
          <BrandLogo size="lg" />
          <p className="w-full text-center text-sm text-ink-secondary">
            {forgotMode ? (forgotSent ? 'Email enviado' : 'Recuperar contraseña') : 'Panel de acceso'}
          </p>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-card dark:shadow-none">
          {forgotMode ? (
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false)
                  setForgotSent(false)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary transition-colors -mt-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Volver al login
              </button>

              {forgotSent ? (
                <div className="flex flex-col items-center text-center gap-4 py-1">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-status-generated/15 text-status-generated"
                    aria-hidden
                  >
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-base font-semibold text-ink-primary">Revisá tu correo</h2>
                    <p className="text-sm text-ink-secondary leading-relaxed max-w-[18rem]">
                      Si el email está registrado, te enviamos un enlace para elegir una contraseña nueva.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl border border-surface-border bg-surface-elevated/60 px-3.5 py-3 text-left w-full">
                    <Inbox className="h-4 w-4 shrink-0 text-ink-muted mt-0.5" aria-hidden />
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      Mirá también la carpeta de <span className="text-ink-primary font-medium">spam</span>. El enlace
                      vence en aproximadamente una hora; pedí otro si expiró.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
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
                  <div className="flex flex-col items-center text-center gap-3 pb-1">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary"
                      aria-hidden
                    >
                      <KeyRound className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-ink-primary">¿Olvidaste tu contraseña?</h2>
                      <p className="text-sm text-ink-secondary leading-relaxed">
                        Ingresá tu email y te mandamos un enlace seguro para restablecerla.
                      </p>
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
                      className="w-full bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-none"
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
            <>
              <div className="flex rounded-xl bg-surface-elevated p-1 mb-6">
                <button
                  type="button"
                  onClick={() => setTab('password')}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === 'password'
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  Contraseña
                </button>
                <button
                  type="button"
                  onClick={() => setTab('magic')}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === 'magic'
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  Magic Link
                </button>
              </div>

              {tab === 'password' ? (
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
                        className="text-ink-muted hover:text-ink-primary transition-colors"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                    error={errors.password?.message}
                    {...register('password')}
                  />
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotMode(true)
                        setForgotSent(false)
                      }}
                      className="text-xs font-medium text-ink-secondary hover:text-brand-primary transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <Button
                    type="submit"
                    className="w-full mt-2 bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-none"
                    loading={isSubmitting}
                    icon={<ArrowRight className="h-4 w-4" />}
                    iconPosition="right"
                  >
                    Ingresar
                  </Button>
                </form>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto mb-3">
                    <Zap className="h-6 w-6 text-ink-muted" />
                  </div>
                  <h3 className="font-semibold text-ink-primary">Actualmente deshabilitado</h3>
                  <p className="text-sm text-ink-secondary mt-2 leading-relaxed">
                    El acceso por Magic Link no está disponible por el momento.
                    <br />
                    Usá la pestaña <strong className="text-ink-primary">Contraseña</strong> para ingresar.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-ink-muted mt-6">
          Haciéndolo Hábito · fitness · hábitos · progreso · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
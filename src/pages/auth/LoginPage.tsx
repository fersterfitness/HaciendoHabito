import { useState, useEffect } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Mail, Lock, ArrowRight, Zap } from 'lucide-react'
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

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { user } = useAuth()
  const navigate = useAppNavigate()
  const { theme, toggleTheme } = useTheme()
  const [tab, setTab] = useState<'password' | 'magic'>('password')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  // Navigate once the auth store confirms the user is set.
  // Do NOT navigate inside onSubmit — the store isn't updated yet at that point.
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  if (user) return <Navigate to="/dashboard" replace />

  async function onSubmit(data: LoginForm) {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      toast.error(
        error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : error.message
      )
    }
    // Navigation is handled by the useEffect above when user is set in the store
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
          <p className="w-full text-center text-sm text-ink-secondary">Panel de acceso</p>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-card dark:shadow-none">
          {/* Tabs */}
          <div className="flex rounded-xl bg-surface-elevated p-1 mb-6">
            <button
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
                placeholder="tu@email.com"
                leftIcon={<Mail className="h-4 w-4" />}
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Contraseña"
                type="password"
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
                error={errors.password?.message}
                {...register('password')}
              />
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
                El acceso por Magic Link no está disponible por el momento.<br />
                Usá la pestaña <strong className="text-ink-primary">Contraseña</strong> para ingresar.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-ink-muted mt-6">
          Haciéndolo Hábito · fitness · hábitos · progreso · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

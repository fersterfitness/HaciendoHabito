import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight, Zap, Sun, Moon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [tab, setTab] = useState<'password' | 'magic'>('password')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

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
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4 relative">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-surface-card border border-transparent hover:border-surface-border transition-all"
        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/app_icon_original_1024.png"
            alt="Haciéndolo Hábito"
            className="w-28 h-28 object-contain mx-auto mb-4"
          />
          <p className="text-sm text-ink-secondary">Panel de entrenador</p>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-card dark:shadow-none">
          {/* Tabs */}
          <div className="flex rounded-xl bg-surface-elevated p-1 mb-6">
            <button
              onClick={() => setTab('password')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'password'
                  ? 'bg-brand-primary text-white'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              Contraseña
            </button>
            <button
              onClick={() => setTab('magic')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'magic'
                  ? 'bg-brand-primary text-white'
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
                className="w-full mt-2"
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

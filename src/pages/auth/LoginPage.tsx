import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
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
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicEmail, setMagicEmail] = useState('')
  const [magicLoading, setMagicLoading] = useState(false)
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

  async function sendMagicLink() {
    if (!magicEmail) { toast.error('Ingresá tu email'); return }
    setMagicLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    setMagicLoading(false)
    if (error) { toast.error(error.message) }
    else { setMagicLinkSent(true) }
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-xl">FF</span>
          </div>
          <h1 className="text-2xl font-bold text-ink-primary">Haciéndolo Hábito</h1>
          <p className="text-sm text-ink-secondary mt-1">Panel de entrenador</p>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
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
          ) : magicLinkSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-status-generated/10 flex items-center justify-center mx-auto mb-3">
                <Mail className="h-6 w-6 text-status-generated" />
              </div>
              <h3 className="font-semibold text-ink-primary">¡Link enviado!</h3>
              <p className="text-sm text-ink-secondary mt-1">
                Revisá tu email <strong className="text-ink-primary">{magicEmail}</strong> y hacé
                click en el link para ingresar.
              </p>
              <button
                onClick={() => setMagicLinkSent(false)}
                className="mt-4 text-xs text-ink-muted hover:text-brand-primary transition-colors"
              >
                ¿No llegó? Reintentar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                leftIcon={<Mail className="h-4 w-4" />}
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={sendMagicLink}
                loading={magicLoading}
                icon={<ArrowRight className="h-4 w-4" />}
                iconPosition="right"
              >
                Enviar Magic Link
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-ink-muted mt-6">
          Haciéndolo Hábito · Ferster Fitness · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

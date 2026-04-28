import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Moon, Sun } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
import { Header } from '@/components/layout/Header'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FormSection } from '@/components/ui/FormSection'
import { Card } from '@/components/ui/Card'
import toast from 'react-hot-toast'
import type { AppRole } from '@/types/database'

const schema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  phone: z.string().optional().or(z.literal('')),
  bio: z.string().optional().or(z.literal('')),
  role: z.enum(['trainer', 'nutritionist', 'admin']),
})

type FormValues = z.infer<typeof schema>

export function SettingsPage() {
  const { profile, setProfile } = useAuthStore()
  const { theme, toggleTheme } = useTheme()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name,
        phone: profile.phone ?? '',
        bio: profile.bio ?? '',
        role:
          profile.role === 'admin'
            ? 'admin'
            : profile.role === 'nutritionist'
            ? 'nutritionist'
            : 'trainer',
      })
    }
  }, [profile, reset])

  async function onSubmit(values: FormValues) {
    if (!profile) return
    const isAdminProfile = profile.role === 'admin'
    const nextRole: AppRole = isAdminProfile
      ? 'admin'
      : values.role === 'nutritionist'
      ? 'nutritionist'
      : 'trainer'
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: values.full_name,
        phone: values.phone || null,
        bio: values.bio || null,
        role: nextRole,
      })
      .eq('id', profile.id)
      .select()
      .single()
    if (error) { toast.error(error.message) }
    else { setProfile(data); toast.success('Perfil actualizado') }
  }

  return (
    <div>
      <Header title="Configuración" />
      <div className="px-4 lg:px-6 py-6 max-w-lg space-y-6">

        {/* Apariencia */}
        <Card>
          <FormSection title="Apariencia">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-ink-primary">Tema</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {theme === 'dark' ? 'Modo oscuro activo' : 'Modo claro activo'}
                </p>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-border bg-surface-elevated hover:bg-surface-border/60 transition-colors text-sm font-medium text-ink-secondary"
              >
                {theme === 'dark'
                  ? <><Sun className="h-4 w-4 text-brand-primary" /> Claro</>
                  : <><Moon className="h-4 w-4 text-brand-primary" /> Oscuro</>
                }
              </button>
            </div>
          </FormSection>
        </Card>

        {/* Perfil */}
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormSection title="Perfil">
              <Input label="Nombre completo" required error={errors.full_name?.message} {...register('full_name')} />
              <Input label="Teléfono" type="tel" {...register('phone')} />
              <Input label="Bio / Descripción" {...register('bio')} />
              <Select
                label="Perfil profesional"
                options={[
                  { value: 'trainer', label: 'Entrenador' },
                  { value: 'nutritionist', label: 'Nutricionista' },
                  ...(profile?.role === 'admin' ? [{ value: 'admin', label: 'Admin' }] : []),
                ]}
                hint={profile?.role === 'admin'
                  ? 'El perfil Admin mantiene acceso total y no se puede degradar desde esta pantalla.'
                  : 'Cambia módulos visibles y color principal de la app.'}
                error={errors.role?.message}
                disabled={profile?.role === 'admin'}
                {...register('role')}
              />
            </FormSection>
            <Button type="submit" loading={isSubmitting}>Guardar cambios</Button>
          </form>
        </Card>

      </div>
    </div>
  )
}

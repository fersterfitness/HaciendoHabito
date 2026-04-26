import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FormSection } from '@/components/ui/FormSection'
import { Card } from '@/components/ui/Card'
import toast from 'react-hot-toast'

const schema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  phone: z.string().optional().or(z.literal('')),
  bio: z.string().optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export function SettingsPage() {
  const { profile, setProfile } = useAuthStore()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name,
        phone: profile.phone ?? '',
        bio: profile.bio ?? '',
      })
    }
  }, [profile, reset])

  async function onSubmit(values: FormValues) {
    if (!profile) return
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: values.full_name, phone: values.phone || null, bio: values.bio || null })
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
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormSection title="Perfil">
              <Input label="Nombre completo" required error={errors.full_name?.message} {...register('full_name')} />
              <Input label="Teléfono" type="tel" {...register('phone')} />
              <Input label="Bio / Descripción" {...register('bio')} />
            </FormSection>
            <Button type="submit" loading={isSubmitting}>Guardar cambios</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

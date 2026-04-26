import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useStudents } from '@/hooks/useStudents'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { FormSection } from '@/components/ui/FormSection'
import { STUDENT_LEVELS, STUDENT_STATUSES } from '@/lib/constants'

const schema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  birth_date: z.string().optional().or(z.literal('')),
  level: z.enum(['inicial', 'intermedio', 'avanzado']),
  gender: z.enum(['M', 'F', 'otro']).optional(),
  status: z.enum(['activo', 'inactivo', 'pausado', 'baja']),
  notes: z.string().optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export function StudentFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const { createStudent, updateStudent } = useStudents()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { level: 'inicial', status: 'activo' },
  })

  useEffect(() => {
    if (!isEditing) return
    supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          reset({
            full_name: data.full_name,
            email: data.email ?? '',
            phone: data.phone ?? '',
            birth_date: data.birth_date ?? '',
            level: data.level,
            gender: data.gender ?? undefined,
            status: data.status,
            notes: data.notes ?? '',
          })
        }
      })
  }, [id, isEditing, reset])

  async function onSubmit(values: FormValues) {
    const payload = {
      full_name: values.full_name,
      email: values.email || null,
      phone: values.phone || null,
      birth_date: values.birth_date || null,
      level: values.level,
      gender: values.gender ?? null,
      status: values.status,
      notes: values.notes || null,
      profile_id: null,
    }

    if (isEditing) {
      const result = await updateStudent(id!, payload)
      if (result) navigate(`/students/${id}`)
    } else {
      const result = await createStudent(payload)
      if (result) navigate(`/students/${result.id}`)
    }
  }

  return (
    <div>
      <Header
        title={isEditing ? 'Editar alumno' : 'Nuevo alumno'}
        showBack
      />

      <div className="px-4 lg:px-6 py-6 max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection title="Datos personales">
            <Input
              label="Nombre completo"
              required
              placeholder="Ej: Juan Pérez"
              error={errors.full_name?.message}
              {...register('full_name')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="juan@email.com"
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Teléfono"
                type="tel"
                placeholder="+54 11 1234-5678"
                {...register('phone')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha de nacimiento"
                type="date"
                {...register('birth_date')}
              />
              <Select
                label="Género"
                options={[
                  { value: 'M', label: 'Masculino' },
                  { value: 'F', label: 'Femenino' },
                  { value: 'otro', label: 'Otro' },
                ]}
                placeholder="Seleccionar"
                {...register('gender')}
              />
            </div>
          </FormSection>

          <FormSection title="Estado y nivel">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Nivel"
                required
                options={STUDENT_LEVELS}
                error={errors.level?.message}
                {...register('level')}
              />
              <Select
                label="Estado"
                required
                options={STUDENT_STATUSES}
                error={errors.status?.message}
                {...register('status')}
              />
            </div>
          </FormSection>

          <FormSection title="Notas">
            <Textarea
              label="Observaciones generales"
              placeholder="Patologías, restricciones, información importante..."
              {...register('notes')}
            />
          </FormSection>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEditing ? 'Guardar cambios' : 'Crear alumno'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
import { canonicalizeArgentinaStudentPhone, STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
import { useAuthStore } from '@/stores/authStore'

const PHONE_HINT = `Formato: ${STUDENT_PHONE_FORMAT_HINT} (solo dígitos, +54, espacios entre bloques).`

const schema = z
  .object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  birth_date: z.string().optional().or(z.literal('')),
  level: z.enum(['inicial', 'intermedio', 'avanzado']),
  gender: z.enum(['M', 'F', 'otro']).optional(),
  status: z.enum(['activo', 'inactivo', 'pausado', 'baja']),
  plan_end_date: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})
.superRefine((data, ctx) => {
  if (!data.phone?.trim()) return
  if (!canonicalizeArgentinaStudentPhone(data.phone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: PHONE_HINT,
      path: ['phone'],
    })
  }
})

type FormValues = z.infer<typeof schema>

export function StudentFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const role = useAuthStore((state) => state.profile?.role)
  const entitySingular = role === 'nutritionist' ? 'paciente' : 'alumno'
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
            plan_end_date: data.plan_end_date ?? '',
            notes: data.notes ?? '',
          })
        }
      })
  }, [id, isEditing, reset])

  async function onSubmit(values: FormValues) {
    let phoneCanon: string | null = null
    if (values.phone?.trim()) {
      const canon = canonicalizeArgentinaStudentPhone(values.phone)
      if (!canon) return
      phoneCanon = canon
    }

    const payload = {
      full_name: values.full_name,
      email: values.email || null,
      phone: phoneCanon,
      birth_date: values.birth_date || null,
      level: values.level,
      gender: values.gender ?? null,
      status: values.status,
      plan_end_date: values.plan_end_date || null,
      notes: values.notes || null,
      profile_id: null,
      document_id: null,
      address: null,
      weight_kg: null,
      height_cm: null,
      intake_ferster: null,
      intake_nutrition: null,
      avatar_path: null,
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
        title={isEditing ? `Editar ${entitySingular}` : `Nuevo ${entitySingular}`}
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
                placeholder={STUDENT_PHONE_FORMAT_HINT}
                hint={PHONE_HINT}
                autoComplete="tel"
                error={errors.phone?.message}
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

          <FormSection title="Estado y plan">
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
            <Input
              label="Vencimiento del plan"
              type="date"
              hint="Opcional — se muestra en la lista de alumnos como días restantes"
              {...register('plan_end_date')}
            />
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
              {isEditing ? 'Guardar cambios' : `Crear ${entitySingular}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

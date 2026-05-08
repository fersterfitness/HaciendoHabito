import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useForm, useWatch } from 'react-hook-form'
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
import { FormErrorSummary } from '@/components/ui/FormErrorSummary'
import { emptyToNull } from '@/lib/formUtils'
import { useAuthStore } from '@/stores/authStore'

const PHONE_HINT = `Formato: ${STUDENT_PHONE_FORMAT_HINT} (solo dígitos, +54, espacios entre bloques).`

const schema = z
  .object({
    // ── Identidad
    full_name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
    document_id: z.string().max(32).optional().or(z.literal('')),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    birth_date: z.string().optional().or(z.literal('')),
    gender: z.enum(['M', 'F', 'otro']).optional(),
    gender_other: z.string().max(120).optional().or(z.literal('')),
    address: z.string().max(500).optional().or(z.literal('')),
    // ── Antropometría
    weight_kg: z.coerce.number().min(20).max(400).optional().or(z.literal('')),
    height_cm: z.coerce.number().min(50).max(250).optional().or(z.literal('')),
    // ── Estado / plan (CRM)
    level: z.enum(['inicial', 'intermedio', 'avanzado']),
    status: z.enum(['activo', 'inactivo', 'pausado', 'baja']),
    plan_end_date: z.string().optional().or(z.literal('')),
    // ── Entrenamiento
    training_since: z.enum(['never', 'less_than_1y', '1_to_3y', 'more_than_3y']).optional(),
    days_per_week: z.coerce.number().int().min(1).max(10).optional().or(z.literal('')),
    lifestyle: z.enum(['sedentary', 'light', 'active', 'very_active']).optional(),
    training_intensity: z.enum(['light', 'moderate', 'intense', 'very_intense']).optional(),
    session_duration: z.enum(['30', '60', '90', '120_plus']).optional(),
    equipment: z.enum(['none', 'home', 'gym_basic', 'gym_advanced']).optional(),
    main_goal: z.enum(['healthy_life', 'sport', 'cut_lean', 'bulk']).optional(),
    // ── Salud y hábitos
    pathology: z.enum(['no', 'yes']).optional(),
    pathology_detail: z.string().max(2000).optional().or(z.literal('')),
    discomfort_exercises: z.string().max(2000).optional().or(z.literal('')),
    four_meals: z.enum(['yes', 'no', 'rarely']).optional(),
    sleep_hours: z.enum(['lt5', '5_6', '6_7', '8_plus']).optional(),
    supplements: z.enum(['yes', 'no']).optional(),
    // ── Notas
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
  const navigate = useAppNavigate()
  const role = useAuthStore((state) => state.profile?.role)
  const entitySingular = role === 'nutritionist' ? 'paciente' : 'alumno'
  const { createStudent, updateStudent } = useStudents()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { level: 'inicial', status: 'activo' },
  })

  const genderValue = useWatch({ control, name: 'gender' })
  const pathologyValue = useWatch({ control, name: 'pathology' })

  useEffect(() => {
    if (!isEditing) return
    supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return
        const fi = data.intake_ferster as Record<string, unknown> | null
        reset({
          full_name: data.full_name,
          email: data.email ?? '',
          phone: data.phone ?? '',
          birth_date: data.birth_date ?? '',
          level: data.level,
          gender: data.gender ?? undefined,
          gender_other: (fi?.gender_other as string) ?? '',
          status: data.status,
          plan_end_date: data.plan_end_date ?? '',
          notes: data.notes ?? '',
          document_id: data.document_id ?? '',
          address: data.address ?? '',
          weight_kg: data.weight_kg ?? '',
          height_cm: data.height_cm ?? '',
          training_since: (fi?.training_since as FormValues['training_since']) ?? undefined,
          days_per_week: (fi?.days_per_week as number) ?? '',
          lifestyle: (fi?.lifestyle as FormValues['lifestyle']) ?? undefined,
          training_intensity: (fi?.training_intensity as FormValues['training_intensity']) ?? undefined,
          session_duration: (fi?.session_duration as FormValues['session_duration']) ?? undefined,
          equipment: (fi?.equipment as FormValues['equipment']) ?? undefined,
          main_goal: (fi?.main_goal as FormValues['main_goal']) ?? undefined,
          pathology: (fi?.pathology as FormValues['pathology']) ?? undefined,
          pathology_detail: (fi?.pathology_detail as string) ?? '',
          discomfort_exercises: (fi?.discomfort_exercises as string) ?? '',
          four_meals: (fi?.four_meals as FormValues['four_meals']) ?? undefined,
          sleep_hours: (fi?.sleep_hours as FormValues['sleep_hours']) ?? undefined,
          supplements: (fi?.supplements as FormValues['supplements']) ?? undefined,
        })
      })
  }, [id, isEditing, reset])

  async function onSubmit(values: FormValues) {
    let phoneCanon: string | null = null
    if (values.phone?.trim()) {
      const canon = canonicalizeArgentinaStudentPhone(values.phone)
      if (!canon) return
      phoneCanon = canon
    }

    // Build intake_ferster JSONB only if at least one training field is filled
    const hasIntake = !!(
      values.training_since ||
      values.lifestyle ||
      values.main_goal ||
      values.pathology
    )
    const intakeFerster = hasIntake
      ? {
          version: 1,
          training_since: values.training_since ?? '',
          days_per_week: Number(values.days_per_week) || 0,
          lifestyle: values.lifestyle ?? '',
          training_intensity: values.training_intensity ?? '',
          session_duration: values.session_duration ?? '',
          equipment: values.equipment ?? '',
          main_goal: values.main_goal ?? '',
          pathology: values.pathology ?? 'no',
          pathology_detail: emptyToNull(values.pathology_detail),
          discomfort_exercises: values.discomfort_exercises ?? '',
          four_meals: values.four_meals ?? '',
          sleep_hours: values.sleep_hours ?? '',
          supplements: values.supplements ?? '',
          gender_other: emptyToNull(values.gender_other),
          submitted_at: new Date().toISOString(),
        }
      : null

    const payload = {
      full_name: values.full_name,
      email: emptyToNull(values.email),
      phone: phoneCanon,
      birth_date: emptyToNull(values.birth_date),
      level: values.level,
      gender: values.gender ?? null,
      status: values.status,
      plan_end_date: emptyToNull(values.plan_end_date),
      notes: emptyToNull(values.notes),
      document_id: emptyToNull(values.document_id),
      address: emptyToNull(values.address),
      weight_kg: values.weight_kg !== '' && values.weight_kg != null ? Number(values.weight_kg) : null,
      height_cm: values.height_cm !== '' && values.height_cm != null ? Number(values.height_cm) : null,
      intake_ferster: intakeFerster,
      profile_id: null,
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

      <div className="px-4 lg:px-6 py-6 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormErrorSummary errors={errors} />

          {/* ── Datos personales ── */}
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
            {genderValue === 'otro' && (
              <Input
                label="Especificar género"
                placeholder="..."
                error={errors.gender_other?.message}
                {...register('gender_other')}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Documento (DNI / Pasaporte)"
                placeholder="Ej: 38123456"
                error={errors.document_id?.message}
                {...register('document_id')}
              />
              <Input
                label="Dirección"
                placeholder="Calle, número, ciudad"
                error={errors.address?.message}
                {...register('address')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Peso (kg)"
                type="number"
                placeholder="70"
                error={errors.weight_kg?.message}
                {...register('weight_kg')}
              />
              <Input
                label="Altura (cm)"
                type="number"
                placeholder="170"
                error={errors.height_cm?.message}
                {...register('height_cm')}
              />
            </div>
          </FormSection>

          {/* ── Estado y plan ── */}
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
              hint="Opcional — se muestra en la lista como días restantes"
              {...register('plan_end_date')}
            />
          </FormSection>

          {/* ── Entrenamiento y objetivo ── */}
          <FormSection title="Entrenamiento y objetivo">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Experiencia entrenando"
                options={[
                  { value: 'never', label: 'Nunca entrené' },
                  { value: 'less_than_1y', label: 'Menos de 1 año' },
                  { value: '1_to_3y', label: '1 a 3 años' },
                  { value: 'more_than_3y', label: 'Más de 3 años' },
                ]}
                placeholder="Seleccionar"
                {...register('training_since')}
              />
              <Input
                label="Días por semana"
                type="number"
                placeholder="3"
                error={errors.days_per_week?.message}
                {...register('days_per_week')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Estilo de vida"
                options={[
                  { value: 'sedentary', label: 'Sedentario' },
                  { value: 'light', label: 'Levemente activo' },
                  { value: 'active', label: 'Activo' },
                  { value: 'very_active', label: 'Muy activo' },
                ]}
                placeholder="Seleccionar"
                {...register('lifestyle')}
              />
              <Select
                label="Intensidad habitual"
                options={[
                  { value: 'light', label: 'Suave' },
                  { value: 'moderate', label: 'Moderada' },
                  { value: 'intense', label: 'Intensa' },
                  { value: 'very_intense', label: 'Muy intensa' },
                ]}
                placeholder="Seleccionar"
                {...register('training_intensity')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Duración de sesión"
                options={[
                  { value: '30', label: '30 min' },
                  { value: '60', label: '1 hora' },
                  { value: '90', label: '1 hora 30 min' },
                  { value: '120_plus', label: '2 horas o más' },
                ]}
                placeholder="Seleccionar"
                {...register('session_duration')}
              />
              <Select
                label="Equipamiento disponible"
                options={[
                  { value: 'none', label: 'Sin equipamiento' },
                  { value: 'home', label: 'Casa (básico)' },
                  { value: 'gym_basic', label: 'Gimnasio básico' },
                  { value: 'gym_advanced', label: 'Gimnasio completo' },
                ]}
                placeholder="Seleccionar"
                {...register('equipment')}
              />
            </div>
            <Select
              label="Objetivo principal"
              options={[
                { value: 'healthy_life', label: 'Vida saludable' },
                { value: 'sport', label: 'Rendimiento deportivo' },
                { value: 'cut_lean', label: 'Bajar de peso / definir' },
                { value: 'bulk', label: 'Aumentar masa muscular' },
              ]}
              placeholder="Seleccionar"
              {...register('main_goal')}
            />
          </FormSection>

          {/* ── Salud y hábitos ── */}
          <FormSection title="Salud y hábitos">
            <Select
              label="¿Tiene patologías o toma medicación?"
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Sí' },
              ]}
              placeholder="Seleccionar"
              {...register('pathology')}
            />
            {pathologyValue === 'yes' && (
              <Textarea
                label="Describir patología / medicación"
                placeholder="Descripción detallada..."
                error={errors.pathology_detail?.message}
                {...register('pathology_detail')}
              />
            )}
            <Textarea
              label="Molestias o ejercicios que no puede realizar"
              placeholder="Ej: dolor de rodilla, no puede hacer sentadillas..."
              {...register('discomfort_exercises')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="¿Hace 4 comidas al día?"
                options={[
                  { value: 'yes', label: 'Sí, siempre' },
                  { value: 'rarely', label: 'A veces' },
                  { value: 'no', label: 'No' },
                ]}
                placeholder="Seleccionar"
                {...register('four_meals')}
              />
              <Select
                label="Horas de sueño"
                options={[
                  { value: 'lt5', label: 'Menos de 5 hs' },
                  { value: '5_6', label: '5 a 6 hs' },
                  { value: '6_7', label: '6 a 7 hs' },
                  { value: '8_plus', label: '8 hs o más' },
                ]}
                placeholder="Seleccionar"
                {...register('sleep_hours')}
              />
            </div>
            <Select
              label="¿Toma suplementos?"
              options={[
                { value: 'yes', label: 'Sí' },
                { value: 'no', label: 'No' },
              ]}
              placeholder="Seleccionar"
              {...register('supplements')}
            />
          </FormSection>

          {/* ── Observaciones ── */}
          <FormSection title="Observaciones">
            <Textarea
              label="Notas internas"
              placeholder="Información adicional, restricciones, recordatorios..."
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

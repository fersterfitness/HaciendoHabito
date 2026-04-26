import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, addDays } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useRoutines } from '@/hooks/useRoutines'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { FormSection } from '@/components/ui/FormSection'
import { STUDENT_LEVELS } from '@/lib/constants'
import type { Student, Plan } from '@/types/database'

const schema = z.object({
  student_id: z.string().uuid('Seleccioná un alumno'),
  plan_name: z.string().min(2, 'Ingresá el nombre de la rutina'),
  start_date: z.string().min(1, 'Seleccioná la fecha de inicio'),
  duration_days: z.coerce.number().min(1).max(365),
  level: z.enum(['inicial', 'intermedio', 'avanzado']),
  price: z.coerce.number().min(0).optional(),
  objective: z.string().min(3, 'Ingresá el objetivo del coach'),
  notes: z.string().optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export function RoutineFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEditing = !!id
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { createRoutine, updateRoutine } = useRoutines()
  const [students, setStudents] = useState<Student[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [endDate, setEndDate] = useState<string>('')

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      student_id: searchParams.get('student') ?? '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      duration_days: 30,
      level: 'inicial',
      price: 0,
    },
  })

  const watchStart = watch('start_date')
  const watchDuration = watch('duration_days')

  useEffect(() => {
    if (watchStart && watchDuration) {
      const end = addDays(new Date(watchStart), Number(watchDuration) - 1)
      setEndDate(format(end, 'dd/MM/yyyy'))
    }
  }, [watchStart, watchDuration])

  useEffect(() => {
    if (!user) return
    supabase.from('students').select('id, full_name, level').eq('owner_id', user.id).eq('status', 'activo').order('full_name').then(({ data }) => setStudents((data as Student[]) ?? []))
    supabase.from('plans').select('*').eq('owner_id', user.id).eq('is_active', true).then(({ data }) => setPlans(data ?? []))
  }, [user])

  useEffect(() => {
    if (!isEditing) return
    supabase.from('routines').select('*').eq('id', id).single().then(({ data }) => {
      if (data) reset({
        student_id: data.student_id,
        plan_name: data.name,
        start_date: data.start_date,
        duration_days: data.duration_days,
        level: data.level,
        price: data.price ?? 0,
        objective: data.objective,
        notes: data.notes ?? '',
      })
    })
  }, [id, isEditing, reset])

  async function onSubmit(values: FormValues) {
    if (isEditing) {
      const end_date = format(addDays(new Date(values.start_date), values.duration_days - 1), 'yyyy-MM-dd')
      const result = await updateRoutine(id!, {
        name: values.plan_name,
        student_id: values.student_id,
        start_date: values.start_date,
        end_date,
        duration_days: values.duration_days,
        level: values.level,
        price: values.price ?? 0,
        objective: values.objective,
        notes: values.notes || null,
      })
      if (result) navigate(`/routines/${id}`)
    } else {
      const result = await createRoutine({
        student_id: values.student_id,
        name: values.plan_name,
        start_date: values.start_date,
        duration_days: values.duration_days,
        level: values.level,
        price: values.price ?? 0,
        objective: values.objective,
        notes: values.notes || undefined,
      })
      if (result) navigate(`/routines/${result.id}/editor`)
    }
  }

  const studentOptions = students.map((s) => ({ value: s.id, label: s.full_name }))

  return (
    <div>
      <Header title={isEditing ? 'Editar rutina' : 'Registrar rutina'} showBack />

      <div className="px-4 lg:px-6 py-6 max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection title="Alumno y plan">
            <Select
              label="Alumno"
              required
              options={studentOptions}
              placeholder="Seleccionar alumno"
              error={errors.student_id?.message}
              {...register('student_id')}
            />
            <Input
              label="Nombre de la Rutina"
              required
              placeholder="Ej: Gorila Bronce — Semana 1"
              error={errors.plan_name?.message}
              {...register('plan_name')}
            />
          </FormSection>

          <FormSection title="Período">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha de inicio"
                required
                type="date"
                error={errors.start_date?.message}
                {...register('start_date')}
              />
              <Input
                label="Duración (días)"
                required
                type="number"
                min={1}
                max={365}
                error={errors.duration_days?.message}
                {...register('duration_days')}
              />
            </div>
            {endDate && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-primary/5 border border-brand-primary/20">
                <span className="text-xs text-ink-muted">Fecha de vencimiento:</span>
                <span className="text-sm font-semibold text-brand-primary">{endDate}</span>
              </div>
            )}
          </FormSection>

          <FormSection title="Detalle">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Nivel del alumno"
                required
                options={STUDENT_LEVELS}
                error={errors.level?.message}
                {...register('level')}
              />
              <Input
                label="Precio de la rutina"
                type="number"
                min={0}
                placeholder="0"
                leftIcon={<span className="text-ink-muted text-xs">$</span>}
                {...register('price')}
              />
            </div>
            <Textarea
              label="Objetivo del Coach"
              required
              placeholder="Describí el objetivo principal de esta rutina..."
              error={errors.objective?.message}
              {...register('objective')}
            />
            <Textarea
              label="Aclaraciones importantes"
              placeholder="Lesiones, restricciones, notas técnicas..."
              {...register('notes')}
            />
          </FormSection>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEditing ? 'Guardar cambios' : 'Crear y armar rutina →'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

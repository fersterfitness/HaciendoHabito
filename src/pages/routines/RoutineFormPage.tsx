import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, addDays } from 'date-fns'
import { Copy, Check, Library } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyBlueprintPayloadToRoutine, type RoutineBlueprintPayload } from '@/lib/routine/routineBlueprint'
import { useRoutines } from '@/hooks/useRoutines'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { FormSection } from '@/components/ui/FormSection'
import { STUDENT_LEVELS } from '@/lib/constants'
import type { Student } from '@/types/database'
import toast from 'react-hot-toast'

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
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const { createRoutine, updateRoutine } = useRoutines()
  const [students, setStudents] = useState<Student[]>([])
  const [routineTemplates, setRoutineTemplates] = useState<Array<{ id: string; name: string; student_name?: string | null }>>([])
  const [blueprintTemplates, setBlueprintTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [templateRoutineId, setTemplateRoutineId] = useState('')
  const [templateBlueprintId, setTemplateBlueprintId] = useState('')
  const [endDate, setEndDate] = useState<string>('')

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
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
    supabase
      .from('routines')
      .select('id, name, student:students(full_name)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const items = ((data as Array<{ id: string; name: string; student?: { full_name?: string | null } | null }>) ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          student_name: r.student?.full_name ?? null,
        }))
        setRoutineTemplates(items)
      })
    supabase
      .from('routine_blueprints')
      .select('id, name')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setBlueprintTemplates(((data as Array<{ id: string; name: string }>) ?? []).map((b) => ({ id: b.id, name: b.name })))
      })
  }, [user])

  useEffect(() => {
    if (isEditing) return
    const bp = searchParams.get('blueprint')
    if (bp) {
      setTemplateBlueprintId(bp)
      setTemplateRoutineId('')
    }
  }, [isEditing, searchParams])

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
    async function copyStructureFromTemplate(sourceRoutineId: string, targetRoutineId: string) {
      const { data: templateBlocks, error: blocksError } = await supabase
        .from('routine_blocks')
        .select('*, days:routine_days(*, exercises:routine_exercises(*))')
        .eq('routine_id', sourceRoutineId)
        .order('sort_order')
      if (blocksError) throw new Error(blocksError.message)

      for (const block of (templateBlocks ?? []) as Array<{
        name: string
        sort_order: number
        notes: string | null
        start_date: string | null
        end_date: string | null
        days?: Array<{
          day_name: string
          day_of_week: number | null
          muscle_focus: string | null
          warmup_notes: string | null
          sort_order: number
          exercises?: Array<{
            exercise_id: string
            sort_order: number
            sets: number | null
            reps_min: number | null
            reps_max: number | null
            reps_scheme: string | null
            weight_kg: number | null
            rir: number | null
            rpe: number | null
            rest_seconds: number | null
            tempo: string | null
            video_url: string | null
            technical_notes: string | null
            is_superset: boolean
            superset_group: number | null
          }>
        }>
      }>) {
        const { data: createdBlock, error: blockError } = await supabase
          .from('routine_blocks')
          .insert({
            routine_id: targetRoutineId,
            name: block.name,
            sort_order: block.sort_order,
            notes: block.notes,
            start_date: block.start_date,
            end_date: block.end_date,
          })
          .select('id')
          .single()
        if (blockError || !createdBlock) throw new Error(blockError?.message ?? 'No se pudo copiar bloque')

        for (const day of block.days ?? []) {
          const { data: createdDay, error: dayError } = await supabase
            .from('routine_days')
            .insert({
              block_id: createdBlock.id,
              day_name: day.day_name,
              day_of_week: day.day_of_week,
              muscle_focus: day.muscle_focus,
              warmup_notes: day.warmup_notes,
              sort_order: day.sort_order,
            })
            .select('id')
            .single()
          if (dayError || !createdDay) throw new Error(dayError?.message ?? 'No se pudo copiar día')

          for (const ex of day.exercises ?? []) {
            const { error: exerciseError } = await supabase.from('routine_exercises').insert({
              day_id: createdDay.id,
              exercise_id: ex.exercise_id,
              sort_order: ex.sort_order,
              sets: ex.sets,
              reps_min: ex.reps_min,
              reps_max: ex.reps_max,
              reps_scheme: ex.reps_scheme,
              weight_kg: ex.weight_kg,
              rir: ex.rir,
              rpe: ex.rpe,
              rest_seconds: ex.rest_seconds,
              tempo: ex.tempo,
              video_url: ex.video_url,
              technical_notes: ex.technical_notes,
              is_superset: ex.is_superset,
              superset_group: ex.superset_group,
            })
            if (exerciseError) throw new Error(exerciseError.message)
          }
        }
      }
    }

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
      if (result) {
        if (templateBlueprintId) {
          const loadingId = toast.loading('Aplicando plantilla del diccionario...')
          try {
            const { data: row, error: bpErr } = await supabase
              .from('routine_blueprints')
              .select('payload')
              .eq('id', templateBlueprintId)
              .single()
            if (bpErr || !row) throw new Error(bpErr?.message ?? 'Plantilla no encontrada')
            await applyBlueprintPayloadToRoutine(result.id, row.payload as RoutineBlueprintPayload)
            toast.success('Rutina creada desde plantilla del diccionario', { id: loadingId })
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo aplicar la plantilla', { id: loadingId })
          }
        } else if (templateRoutineId) {
          const loadingId = toast.loading('Copiando estructura de rutina...')
          try {
            await copyStructureFromTemplate(templateRoutineId, result.id)
            toast.success('Rutina creada con estructura copiada', { id: loadingId })
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo copiar la estructura', { id: loadingId })
          }
        }
        navigate(`/routines/${result.id}`)
      }
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
            {!isEditing && (routineTemplates.length > 0 || blueprintTemplates.length > 0) && (
              <div className="rounded-2xl border-2 border-dashed border-surface-border bg-surface-elevated/40 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-brand-primary shrink-0" />
                  <span className="text-sm font-semibold text-ink-primary">Usar plantilla</span>
                  <span className="ml-auto text-[10px] text-ink-muted bg-surface-border px-2 py-0.5 rounded-full">opcional</span>
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Elegí una entrada del{' '}
                  <Link to="/routines?tab=plantillas" className="text-brand-primary font-medium hover:underline">
                    diccionario de plantillas
                  </Link>{' '}
                  o copiá desde una rutina ya creada. Solo aplica una opción a la vez.
                </p>
                {blueprintTemplates.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-ink-primary">
                      <Library className="h-3.5 w-3.5 text-brand-primary" />
                      Desde el diccionario
                    </label>
                    <select
                      value={templateBlueprintId}
                      onChange={(e) => {
                        setTemplateBlueprintId(e.target.value)
                        setTemplateRoutineId('')
                      }}
                      className="w-full bg-surface-card border border-surface-border text-ink-primary rounded-xl px-3 py-2.5 text-sm focus:border-brand-primary outline-none"
                    >
                      <option value="">— Sin plantilla guardada —</option>
                      {blueprintTemplates.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {routineTemplates.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-ink-primary">Copiar desde rutina existente</label>
                    <select
                      value={templateRoutineId}
                      onChange={(e) => {
                        setTemplateRoutineId(e.target.value)
                        setTemplateBlueprintId('')
                      }}
                      className="w-full bg-surface-card border border-surface-border text-ink-primary rounded-xl px-3 py-2.5 text-sm focus:border-brand-primary outline-none"
                    >
                      <option value="">— No copiar —</option>
                      {routineTemplates.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}{r.student_name ? ` · ${r.student_name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {(templateBlueprintId || templateRoutineId) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
                    <Check className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                    <span className="text-xs text-brand-primary font-medium">
                      Se copiarán bloques, días y ejercicios al crear la rutina
                    </span>
                  </div>
                )}
              </div>
            )}
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

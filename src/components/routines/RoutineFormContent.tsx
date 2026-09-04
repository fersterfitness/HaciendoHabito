import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, addDays } from 'date-fns'
import { Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyBlueprintPayloadToRoutine, type RoutineBlueprintPayload } from '@/lib/routine/routineBlueprint'
import { blueprintObjective, withBlueprintMeta } from '@/lib/routine/blueprintFolders'
import { useRoutines } from '@/hooks/useRoutines'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { FormSection } from '@/components/ui/FormSection'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { STUDENT_LEVELS } from '@/lib/constants'
import type { Student, StudentRoutineNote } from '@/types/database'
import { AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { isMonthlyTemplate, parseQuestions } from '@/lib/checkIn/questions'
import { monthlyFeedbackInviteMessage, normalizePhoneForWhatsApp, shareToWhatsApp, WHATSAPP_DIRECT_PASTE_HINT } from '@/lib/whatsapp'

const schema = z.object({
  student_id: z.string().optional().or(z.literal('')),
  plan_name: z.string().min(2, 'Ingresá el nombre de la rutina'),
  start_date: z.string().min(1, 'Seleccioná la fecha de inicio'),
  duration_days: z.coerce.number().min(7).max(364),
  level: z.enum(['inicial', 'intermedio', 'avanzado']),
  objective: z.string().min(3, 'Ingresá el objetivo del coach'),
  notes: z.string().optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export type RoutineFormContentProps = {
  routineId?: string
  initialStudentId?: string
  initialBlueprintId?: string
  onCancel: () => void
  onSuccess: (routineId: string) => void
  /** Clase opcional para acotar ancho en la página (ej. max-w-lg); el modal no la pasa. */
  formClassName?: string
}

export function RoutineFormContent({
  routineId,
  initialStudentId,
  initialBlueprintId,
  onCancel,
  onSuccess,
  formClassName = 'max-w-lg',
}: RoutineFormContentProps) {
  const isEditing = !!routineId
  const { user } = useAuthStore()
  const { createRoutine, updateRoutine } = useRoutines()
  const [students, setStudents] = useState<Student[]>([])
  const [routineTemplates, setRoutineTemplates] = useState<Array<{ id: string; name: string; student_name?: string | null }>>([])
  const [templateRoutineId, setTemplateRoutineId] = useState('')
  const [templateBlueprintId, setTemplateBlueprintId] = useState('')
  const [endDate, setEndDate] = useState<string>('')
  const [saveAsPreset, setSaveAsPreset] = useState(false)
  const [presetMacro, setPresetMacro] = useState('')
  const [presetMeso, setPresetMeso] = useState('')
  const [presetRutina, setPresetRutina] = useState('')
  const [knownMacros, setKnownMacros] = useState<string[]>([])
  const [knownMesos, setKnownMesos] = useState<string[]>([])
  const [feedbackPrompt, setFeedbackPrompt] = useState<{
    routineId: string
    studentName: string
    phone: string | null
  } | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      student_id: initialStudentId ?? '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      duration_days: 28,
      level: 'inicial',
    },
  })

  const watchStart = watch('start_date')
  const watchDuration = watch('duration_days')
  const watchStudentId = watch('student_id')
  // Recordamos el último nombre autogenerado para no pisar uno escrito a mano.
  const autoNameRef = useRef('')

  // Nombre por defecto: "Nombre Apellido + N° de rutina" (ej. "Agustín Peluffo 2").
  useEffect(() => {
    if (isEditing || !watchStudentId || !user) return
    const student = students.find((s) => s.id === watchStudentId)
    if (!student) return
    let cancelled = false
    void supabase
      .from('routines')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('student_id', watchStudentId)
      .then(({ count }) => {
        if (cancelled) return
        const next = `${student.full_name} ${(count ?? 0) + 1}`
        const current = (watch('plan_name') ?? '').trim()
        // Solo autocompletar si está vacío o si era un autogenerado anterior.
        if (!current || current === autoNameRef.current) {
          autoNameRef.current = next
          setValue('plan_name', next, { shouldValidate: true })
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchStudentId, isEditing, students, user])

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
    void supabase
      .from('routine_blueprints')
      .select('category, subcategory')
      .eq('owner_id', user.id)
      .then(({ data }) => {
        const rows = (data ?? []) as { category: string | null; subcategory: string | null }[]
        setKnownMacros([...new Set(rows.map((r) => r.category?.trim()).filter((c): c is string => !!c))].sort())
        setKnownMesos([...new Set(rows.map((r) => r.subcategory?.trim()).filter((c): c is string => !!c))].sort())
      })
  }, [user])

  useEffect(() => {
    if (isEditing) return
    if (initialBlueprintId) {
      setTemplateBlueprintId(initialBlueprintId)
      setTemplateRoutineId('')
    }
  }, [isEditing, initialBlueprintId])

  useEffect(() => {
    if (!templateBlueprintId) return
    void supabase
      .from('routine_blueprints')
      .select('payload, name')
      .eq('id', templateBlueprintId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const obj = blueprintObjective(data)
        if (obj) setValue('objective', obj)
        if (data.name) setValue('plan_name', data.name)
      })
  }, [templateBlueprintId, setValue])

  useEffect(() => {
    if (!isEditing || !routineId) return
    supabase.from('routines').select('*').eq('id', routineId).single().then(({ data }) => {
      if (data) reset({
        student_id: data.student_id,
        plan_name: data.name,
        start_date: data.start_date,
        duration_days: data.duration_days,
        level: data.level,
        objective: data.objective,
        notes: data.notes ?? '',
      })
    })
  }, [routineId, isEditing, reset])

  async function onSubmit(values: FormValues) {
    if (saveAsPreset && !isEditing) {
      if (!user) return
      const { error } = await supabase.from('routine_blueprints').insert({
        owner_id: user.id,
        name: values.plan_name,
        category: presetMacro.trim() || null,
        subcategory: presetMeso.trim() || null,
        description: values.notes?.trim() || values.level,
        payload: withBlueprintMeta(
          { v: 1, blocks: [] },
          {
            routine_group: presetRutina.trim() || values.plan_name,
            objective: values.objective,
            audience: values.level,
          },
        ),
      })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Guardada en rutinas preestablecidas. Ahora podés meterla en un macrociclo.')
      onSuccess('')
      return
    }
    if (!values.student_id) {
      toast.error('Seleccioná un alumno o marcá «Guardar en rutinas preestablecidas»')
      return
    }

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

    if (isEditing && routineId) {
      const end_date = format(addDays(new Date(values.start_date), values.duration_days - 1), 'yyyy-MM-dd')
      const result = await updateRoutine(routineId, {
        name: values.plan_name,
        student_id: values.student_id,
        start_date: values.start_date,
        end_date,
        duration_days: values.duration_days,
        level: values.level,
        objective: values.objective,
        notes: values.notes || null,
      })
      if (result) onSuccess(routineId)
    } else {
      const { count: priorCount } = await supabase
        .from('routines')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', values.student_id)
      const hadPrevious = (priorCount ?? 0) > 0
      const result = await createRoutine({
        student_id: values.student_id,
        name: values.plan_name,
        start_date: values.start_date,
        duration_days: values.duration_days,
        level: values.level,
        objective: values.objective,
        notes: values.notes || undefined,
      })
      if (result) {
        if (templateBlueprintId) {
          const loadingId = toast.loading('Copiando rutina preestablecida...')
          try {
            const { data: row, error: bpErr } = await supabase
              .from('routine_blueprints')
              .select('payload')
              .eq('id', templateBlueprintId)
              .single()
            if (bpErr || !row) throw new Error(bpErr?.message ?? 'Variante no encontrada')
            await applyBlueprintPayloadToRoutine(result.id, row.payload as RoutineBlueprintPayload)
            toast.success('Rutina creada desde la variante preestablecida', { id: loadingId })
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo copiar la variante', { id: loadingId })
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
        if (hadPrevious) {
          const st = students.find((s) => s.id === values.student_id)
          setFeedbackPrompt({
            routineId: result.id,
            studentName: st?.full_name ?? 'el alumno',
            phone: st?.phone ?? null,
          })
        } else {
          onSuccess(result.id)
        }
      }
    }
  }

  const studentOptions = students.map((s) => ({ value: s.id, label: s.full_name }))

  return (
    <div className={formClassName}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormSection title="Alumno y plan">
          {!isEditing ? (
            <label className="flex items-start gap-2 rounded-xl border border-surface-border/70 bg-surface-elevated/20 px-3 py-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={saveAsPreset}
                onChange={(e) => setSaveAsPreset(e.target.checked)}
                className="mt-0.5 rounded border-surface-border"
              />
              <span>
                <strong className="text-ink-primary">Guardar en rutinas preestablecidas</strong>
                <span className="mt-0.5 block text-[11px] text-ink-muted">
                  No asigna un alumno. Queda en preestablecidas para testear o asignar después.
                </span>
              </span>
            </label>
          ) : null}
          {saveAsPreset && !isEditing ? (
            <div className="grid gap-3 rounded-xl border border-surface-border/70 bg-surface-elevated/15 p-3 sm:grid-cols-3">
              <label className="text-[11px] font-medium text-ink-secondary">
                Macrociclo
                <input
                  list="new-routine-macros"
                  value={presetMacro}
                  onChange={(e) => setPresetMacro(e.target.value)}
                  placeholder="Ej. Adaptación Neural"
                  className="mt-1 w-full rounded-lg border border-surface-border bg-surface-input px-2 py-1.5 text-xs text-ink-primary"
                />
              </label>
              <label className="text-[11px] font-medium text-ink-secondary">
                Mesociclo
                <input
                  list="new-routine-mesos"
                  value={presetMeso}
                  onChange={(e) => setPresetMeso(e.target.value)}
                  placeholder="Ej. Fase NTC"
                  className="mt-1 w-full rounded-lg border border-surface-border bg-surface-input px-2 py-1.5 text-xs text-ink-primary"
                />
              </label>
              <label className="text-[11px] font-medium text-ink-secondary">
                Rutina (carpeta)
                <input
                  value={presetRutina}
                  onChange={(e) => setPresetRutina(e.target.value)}
                  placeholder="Nombre de la rutina madre"
                  className="mt-1 w-full rounded-lg border border-surface-border bg-surface-input px-2 py-1.5 text-xs text-ink-primary"
                />
              </label>
              <datalist id="new-routine-macros">
                {knownMacros.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <datalist id="new-routine-mesos">
                {knownMesos.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          ) : null}
          <Select
            label="Alumno"
            required={!saveAsPreset}
            options={studentOptions}
            placeholder={saveAsPreset ? 'Opcional si guardás como preestablecida' : 'Seleccionar alumno'}
            error={errors.student_id?.message}
            {...register('student_id')}
          />
          <PendingRoutineNotesBanner studentId={watchStudentId} />
          <Input
            label="Nombre de la Rutina"
            required
            placeholder="Ej: Gorila Bronce — Semana 1"
            error={errors.plan_name?.message}
            {...register('plan_name')}
          />
          {!isEditing && (routineTemplates.length > 0 || templateBlueprintId) && (
            <div className="rounded-2xl border border-dashed border-zinc-300/80 bg-zinc-50/80 p-4 space-y-4 dark:border-zinc-600/50 dark:bg-zinc-900/35">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Copiar desde rutina existente</span>
                <span className="ml-auto rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-700/60 dark:text-zinc-400">
                  opcional
                </span>
              </div>
              {templateBlueprintId ? (
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Esta rutina se va a armar con una variante de <strong>Rutinas preestablecidas</strong>.
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Copiá bloques, días y ejercicios de otra rutina ya creada. Las variantes preestablecidas se asignan desde la ficha del alumno o desde Base de datos.
                </p>
              )}
              {routineTemplates.length > 0 && !templateBlueprintId ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-primary">Rutina a copiar</label>
                  <select
                    value={templateRoutineId}
                    onChange={(e) => setTemplateRoutineId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200/90 bg-surface-card px-3 py-2.5 text-sm text-ink-primary outline-none focus:border-zinc-400 dark:border-zinc-600/80 dark:focus:border-zinc-500"
                  >
                    <option value="">— No copiar —</option>
                    {routineTemplates.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}{r.student_name ? ` · ${r.student_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {(templateBlueprintId || templateRoutineId) && (
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-zinc-100/90 px-3 py-2 dark:border-zinc-600/45 dark:bg-zinc-800/50">
                  <Check className="h-3.5 w-3.5 shrink-0 text-zinc-600 dark:text-zinc-300" />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
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
              label="Duración (semanas)"
              required
              type="number"
              min={1}
              max={52}
              error={errors.duration_days?.message}
              value={Math.max(1, Math.round((Number(watchDuration) || 28) / 7))}
              onChange={(e) => {
                const weeks = Number(e.target.value)
                const safe = Number.isFinite(weeks) && weeks > 0 ? Math.min(52, Math.round(weeks)) : 1
                setValue('duration_days', safe * 7, { shouldValidate: true, shouldDirty: true })
              }}
            />
          </div>
          {endDate && (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3 py-2 dark:border-zinc-600/40 dark:bg-zinc-900/40">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Fecha de vencimiento:</span>
              <span className="text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">{endDate}</span>
            </div>
          )}
        </FormSection>

        <FormSection title="Detalle">
          <Select
            label="Para quién (principiantes, avanzados…)"
            required
            options={STUDENT_LEVELS}
            error={errors.level?.message}
            {...register('level')}
          />
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
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEditing ? 'Guardar cambios' : 'Crear y armar rutina →'}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={!!feedbackPrompt}
        onClose={() => {
          const id = feedbackPrompt?.routineId
          setFeedbackPrompt(null)
          if (id) onSuccess(id)
        }}
        onConfirm={() => {
          void (async () => {
            if (!feedbackPrompt) return
            const { data: forms } = await supabase.from('check_in_forms').select('questions, public_token').eq('owner_id', user!.id)
            const monthly = (forms ?? []).find((f) => isMonthlyTemplate(parseQuestions(f.questions)))
            const url = monthly?.public_token
              ? `${window.location.origin}/form/check-in/compartido/${monthly.public_token}`
              : ''
            if (!url) {
              toast.error('Creá un formulario con la plantilla de feedback mensual.')
              return
            }
            const digits = normalizePhoneForWhatsApp(feedbackPrompt.phone)
            if (!digits) {
              toast.error('Sin teléfono válido en la ficha')
              return
            }
            const res = await shareToWhatsApp({
              phoneDigits: digits,
              message: monthlyFeedbackInviteMessage({ studentName: feedbackPrompt.studentName, url }),
            })
            if (res.copied) toast.success(WHATSAPP_DIRECT_PASTE_HINT)
            const id = feedbackPrompt.routineId
            setFeedbackPrompt(null)
            onSuccess(id)
          })()
        }}
        variant="warning"
        title="Feedback mensual de la rutina anterior"
        description={`Mandale a ${feedbackPrompt?.studentName ?? 'el alumno'} el feedback mensual de la rutina que cierra. Sirve como testimonio para redes.`}
        confirmLabel="Enviar por WhatsApp"
        cancelLabel="Ahora no"
      />
    </div>
  )
}

/** Muestra las notas pendientes del alumno seleccionado al armar la rutina. */
function PendingRoutineNotesBanner({ studentId }: { studentId?: string }) {
  const [notes, setNotes] = useState<StudentRoutineNote[]>([])

  useEffect(() => {
    if (!studentId) {
      setNotes([])
      return
    }
    let cancelled = false
    supabase
      .from('student_routine_notes')
      .select('*')
      .eq('student_id', studentId)
      .eq('is_done', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setNotes((data as StudentRoutineNote[]) ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  if (notes.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-400/60 bg-amber-50 p-3.5 dark:border-amber-600/50 dark:bg-amber-950/25">
      <div className="mb-2 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Notas a tener en cuenta ({notes.length})
        </span>
      </div>
      <ul className="space-y-1">
        {notes.map((n) => (
          <li key={n.id} className="flex gap-2 text-[13px] text-zinc-800 dark:text-zinc-100">
            <span className="text-amber-500">•</span>
            <span>{n.content}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

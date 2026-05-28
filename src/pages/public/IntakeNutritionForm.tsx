import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { canonicalizeArgentinaStudentPhone, STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
import toast from 'react-hot-toast'
import {
  intakeAttachPlusBox,
  intakeFormFieldLabelClass,
  intakeFormFieldLabelInlineClass,
  intakeFormInputClass,
} from '@/lib/intake/intakeFormUi'
import { IntakeFormStepNav } from '@/components/public/intake/IntakeFormStepNav'
import { IntakeFormSection } from '@/components/public/intake/IntakeFormSection'
import { IntakeFormPlanHint } from '@/components/public/intake/IntakeFormPlanHint'
import { IntakeFormShell } from '@/components/public/intake/IntakeFormShell'
import { IntakeFormStepActions } from '@/components/public/intake/IntakeFormStepActions'
import {
  nutritionIntakeSchema,
  nutritionDefaults,
  FOOD_ITEMS,
  type NutritionIntakeFormValues,
} from '@/lib/intake/nutritionIntakeSchema'
import { compressImageFileForUpload } from '@/lib/compressImageForUpload'
import { IntakePaymentPreferenceFields } from '@/components/public/IntakePaymentPreferenceFields'
import { IntakeQuickTextFill } from '@/components/public/IntakeQuickTextFill'
import type { IntakeProfessional } from '@/lib/intake/intakeProfessionals'
import { submitPublicIntake } from '@/lib/intake/submitPublicIntake'

const MAX_BYTES = 10 * 1024 * 1024
const PHONE_HINT = `Formato: ${STUDENT_PHONE_FORMAT_HINT}`

// Campos requeridos por paso (los opcionales no se validan al avanzar)
const STEP_FIELDS: (keyof NutritionIntakeFormValues)[][] = [
  ['first_name', 'last_name', 'birth_date', 'email', 'phone'],
  ['weight_kg', 'height_cm'],
  [],
  [],
  [],
  ['payment_preference', 'payment_notes', 'accept_privacy'],
]

const STEP_TITLES = ['Datos', 'Salud', 'Actividad', '24 h', 'Hábitos', 'Pago']

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className={intakeFormFieldLabelClass()}>
      {children}
      {required ? <span className="text-zinc-500 dark:text-zinc-400">*</span> : null}
    </label>
  )
}

const inputClass = intakeFormInputClass

const taClass = (err?: string) => cn(inputClass(err), 'resize-y min-h-[88px]')

const FREQ_OPTIONS = ['', 'Diario', 'Semanal', 'Quincenal', 'Mensual', 'X']

type Props = {
  onSuccess: () => void
  selectedPlanSlug?: string | null
  selectedPlanLabel?: string | null
  selectedPlanPrice?: string | null
  selectedNutritionist?: IntakeProfessional | null
  compact?: boolean
  onRequestChangePlan?: () => void
}

export function IntakeNutritionForm({
  onSuccess,
  selectedPlanSlug = null,
  selectedPlanLabel = null,
  selectedPlanPrice = null,
  selectedNutritionist = null,
  compact = false,
  onRequestChangePlan,
}: Props) {
  const [step, setStep] = useState(0)
  const [stepNavHint, setStepNavHint] = useState<string | null>(null)
  const [phoneFocused, setPhoneFocused] = useState(false)
  const stepNavHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [labFile, setLabFile] = useState<File | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NutritionIntakeFormValues>({
    resolver:
      zodResolver(nutritionIntakeSchema) as Resolver<NutritionIntakeFormValues>,
    defaultValues: nutritionDefaults() as NutritionIntakeFormValues,
  })

  const hasActivity = watch('has_physical_activity')

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  useEffect(() => {
    return () => { if (profilePreview) URL.revokeObjectURL(profilePreview) }
  }, [profilePreview])

  useEffect(() => {
    return () => {
      if (stepNavHintTimerRef.current) clearTimeout(stepNavHintTimerRef.current)
    }
  }, [])

  const flashStepNavHint = useCallback((message: string) => {
    if (stepNavHintTimerRef.current) clearTimeout(stepNavHintTimerRef.current)
    setStepNavHint(message)
    stepNavHintTimerRef.current = setTimeout(() => {
      setStepNavHint(null)
      stepNavHintTimerRef.current = null
    }, 4200)
  }, [])

  async function goNext() {
    const fields = STEP_FIELDS[step]
    // Pasos sin lista explícita: avanzar sin `trigger(undefined)` — eso validaría TODO el schema y bloquearía al fallar campos de pasos posteriores.
    if (fields.length === 0) {
      setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1))
      return
    }
    const ok = await trigger(fields, { shouldFocus: true })
    if (ok) setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1))
  }

  async function trySetStep(target: number) {
    if (target === step) return
    if (target < 0 || target >= STEP_TITLES.length) return
    if (target < step) {
      setStep(target)
      return
    }
    for (let s = step; s < target; s++) {
      const fields = STEP_FIELDS[s]
      if (fields.length === 0) continue
      const ok = await trigger(fields, { shouldFocus: true })
      if (!ok) {
        flashStepNavHint(
          'Completá los pasos anteriores para llegar ahí. El cursor marca el primer dato pendiente.',
        )
        return
      }
    }
    setStep(target)
  }

  async function onSubmit(values: NutritionIntakeFormValues) {
    const phone = canonicalizeArgentinaStudentPhone(values.phone)
    if (!phone) return

    const payload = {
      ...values,
      phone,
      form_type: 'nutrition',
      selected_plan_slug: selectedPlanSlug,
      intake_nutritionist_slug: selectedNutritionist?.slug ?? '',
      website: '',
    }

    const hasFiles = profileFile !== null || labFile !== null
    let submitFiles: { profile?: File | null; medical?: File | null } | undefined
    if (hasFiles) {
      const profilePrepared = profileFile ? await compressImageFileForUpload(profileFile) : null
      const labPrepared =
        labFile && labFile.type.startsWith('image/')
          ? await compressImageFileForUpload(labFile)
          : labFile
      submitFiles = { profile: profilePrepared, medical: labPrepared }
    }

    const result = await submitPublicIntake(payload, submitFiles)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    if (result.warnings?.length) {
      toast(result.warnings.join(' '), { icon: 'ℹ️', duration: 9000 })
    }

    toast.success('¡Listo!')
    onSuccess()
  }

  return (
    <div ref={scrollRef} className="w-full max-w-lg mx-auto lg:mx-0 lg:max-w-md">
      <IntakeFormPlanHint
        compact={compact}
        selectedPlanLabel={selectedPlanLabel}
        selectedPlanPrice={selectedPlanPrice}
        onRequestChangePlan={onRequestChangePlan}
      />

      <IntakeFormShell>
        <IntakeFormStepNav
          step={step}
          stepTitles={STEP_TITLES}
          stepNavHint={stepNavHint}
          onGoToStep={(i) => void trySetStep(i)}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {step === 0 && (
          <div className="space-y-5">
            <IntakeFormSection title="Consulta">
              <div>
                <FieldLabel>Motivo de consulta</FieldLabel>
                <textarea
                  rows={3}
                  className={taClass()}
                  placeholder="¿Por qué buscás asesoramiento nutricional?"
                  {...register('motivo_consulta')}
                />
              </div>
            </IntakeFormSection>

            <IntakeFormSection title="Tus datos">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <FieldLabel required>Nombre</FieldLabel>
                  <input type="text" autoComplete="given-name" className={inputClass(errors.first_name?.message)} {...register('first_name')} />
                  {errors.first_name?.message && <p className="mt-1 text-xs text-status-expired">{errors.first_name.message}</p>}
                </div>
                <div>
                  <FieldLabel required>Apellido</FieldLabel>
                  <input type="text" autoComplete="family-name" className={inputClass(errors.last_name?.message)} {...register('last_name')} />
                  {errors.last_name?.message && <p className="mt-1 text-xs text-status-expired">{errors.last_name.message}</p>}
                </div>
              </div>
              <div>
                <FieldLabel required>Fecha de nacimiento</FieldLabel>
                <input type="date" className={inputClass(errors.birth_date?.message)} {...register('birth_date')} />
                {errors.birth_date?.message && <p className="mt-1 text-xs text-status-expired">{errors.birth_date.message}</p>}
              </div>
              <div>
                <FieldLabel required>Correo electrónico</FieldLabel>
                <input type="email" autoComplete="email" className={inputClass(errors.email?.message)} {...register('email')} />
                {errors.email?.message && <p className="mt-1 text-xs text-status-expired">{errors.email.message}</p>}
              </div>
              <div>
                <FieldLabel required>Teléfono</FieldLabel>
                <input
                  type="tel"
                  autoComplete="tel"
                  className={inputClass(errors.phone?.message)}
                  {...register('phone', {
                    onFocus: () => setPhoneFocused(true),
                    onBlur: (e) => {
                      setPhoneFocused(false)
                      const digits = e.target.value.replace(/\D/g, '')
                      if (!digits) return
                      let rest = digits
                      if (digits.startsWith('54')) rest = digits.slice(2)
                      else if (digits.startsWith('0')) rest = digits.slice(1)
                      const formatted = `+54 ${rest.slice(0, 2)} ${rest.slice(2)}`
                      if (formatted !== e.target.value) setValue('phone', formatted, { shouldValidate: true })
                    },
                  })}
                />
                {errors.phone?.message ? (
                  <p className="mt-1 text-xs text-status-expired">{errors.phone.message}</p>
                ) : phoneFocused ? (
                  <p className="mt-1 text-[11px] text-ink-muted">{PHONE_HINT}</p>
                ) : null}
              </div>
            </IntakeFormSection>

            <IntakeFormSection title="Vida diaria">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <FieldLabel>Profesión / Ocupación</FieldLabel>
                  <input type="text" className={inputClass()} placeholder="ej: docente" {...register('profession')} />
                </div>
                <div>
                  <FieldLabel>Horario de trabajo</FieldLabel>
                  <input type="text" className={inputClass()} placeholder="ej: 8 a 17hs" {...register('work_hours')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <FieldLabel>Estado civil</FieldLabel>
                  <input type="text" className={inputClass()} placeholder="ej: soltero/a" {...register('marital_status')} />
                </div>
                <div>
                  <FieldLabel>Convivís con</FieldLabel>
                  <input type="text" className={inputClass()} placeholder="ej: pareja e hijos" {...register('family_composition')} />
                </div>
              </div>
              <div>
                <FieldLabel>Hobbies</FieldLabel>
                <input type="text" className={inputClass()} placeholder="ej: lectura, caminatas..." {...register('hobbies')} />
              </div>
            </IntakeFormSection>
          </div>
        )}

        {/* ── Paso 1: Salud y antropometría ────────────────────────────────── */}
        {step === 1 && (
          <>
            <p className="rounded-xl border border-[#ff6a00]/20 bg-[#ff6a00]/[0.08] px-4 py-3 text-xs leading-relaxed text-ink-secondary">
              Las medidas de cintura, cadera y brazo las tomará el profesional en la consulta. Solo completá peso y altura.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Peso actual (kg)</FieldLabel>
                <input type="number" step="0.1" className={inputClass(errors.weight_kg?.message)}
                  {...register('weight_kg', { valueAsNumber: true })} />
                {errors.weight_kg?.message && <p className="mt-1 text-xs text-status-expired">{String(errors.weight_kg.message)}</p>}
              </div>
              <div>
                <FieldLabel required>Altura (cm)</FieldLabel>
                <input type="number" className={inputClass(errors.height_cm?.message)}
                  {...register('height_cm', { valueAsNumber: true })} />
                {errors.height_cm?.message && <p className="mt-1 text-xs text-status-expired">{String(errors.height_cm.message)}</p>}
              </div>
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <label className={intakeFormFieldLabelInlineClass()}>Patologías presentes</label>
                <IntakeQuickTextFill
                  fillValue="Ninguna"
                  onFill={(t) => setValue('pathologies', t, { shouldValidate: true, shouldDirty: true })}
                />
              </div>
              <textarea rows={2} className={taClass()} placeholder="ej: hipotiroidismo, diabetes... o ninguna" {...register('pathologies')} />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <label className={intakeFormFieldLabelInlineClass()}>Medicación que tomás</label>
                <IntakeQuickTextFill
                  fillValue="Ninguna"
                  onFill={(t) => setValue('medications', t, { shouldValidate: true, shouldDirty: true })}
                />
              </div>
              <textarea rows={2} className={taClass()} placeholder="Nombre y dosis, o ninguna" {...register('medications')} />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <label className={intakeFormFieldLabelInlineClass()}>Suplementación</label>
                <IntakeQuickTextFill
                  fillValue="Ninguna"
                  onFill={(t) => setValue('supplementation', t, { shouldValidate: true, shouldDirty: true })}
                />
              </div>
              <input type="text" className={inputClass()} placeholder="ej: proteína en polvo, creatina... o ninguna" {...register('supplementation')} />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <label className={intakeFormFieldLabelInlineClass()}>Síntomas presentes</label>
                <IntakeQuickTextFill
                  onFill={(t) => setValue('symptoms', t, { shouldValidate: true, shouldDirty: true })}
                />
              </div>
              <textarea rows={2} className={taClass()} placeholder="Síntomas digestivos, hinchazón, acidez, etc." {...register('symptoms')} />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <label className={intakeFormFieldLabelInlineClass()}>Antecedentes familiares</label>
                <IntakeQuickTextFill
                  fillValue="Ninguno"
                  onFill={(t) => setValue('family_history', t, { shouldValidate: true, shouldDirty: true })}
                />
              </div>
              <textarea rows={2} className={taClass()} placeholder="Diabetes, obesidad, hipotiroidismo, colesterol alto, etc." {...register('family_history')} />
            </div>

            <div>
              <FieldLabel>Tabaquismo</FieldLabel>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="no" className="accent-zinc-600 dark:accent-zinc-500" {...register('smoking')} />
                  No
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="si" className="accent-zinc-600 dark:accent-zinc-500" {...register('smoking')} />
                  Sí
                </label>
              </div>
            </div>

            <div>
              <FieldLabel>Análisis de laboratorio (PDF o imagen, opcional)</FieldLabel>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface-elevated/40 px-2.5 py-2 transition-colors hover:border-zinc-400/50 hover:bg-zinc-500/[0.06] dark:hover:border-white/20 dark:hover:bg-white/[0.04]">
                <span className={intakeAttachPlusBox()} aria-hidden>+</span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">
                  {labFile ? labFile.name : 'Elegir archivo'}
                </span>
                {labFile && (
                  <button
                    type="button"
                    aria-label="Quitar archivo"
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-muted hover:bg-surface-border/50 hover:text-ink-secondary"
                    onClick={(e) => {
                      e.preventDefault()
                      setLabFile(null)
                    }}
                  >
                    ×
                  </button>
                )}
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    if (f && f.size > MAX_BYTES) {
                      toast.error('Máximo 10 MB')
                      return
                    }
                    setLabFile(f)
                  }}
                />
              </label>
              <p className="mt-1 text-[11px] text-ink-muted">Antigüedad máxima 2 años</p>
            </div>
          </>
        )}

        {/* ── Paso 2: Actividad física y hábitos alimentarios ───────────────── */}
        {step === 2 && (
          <>
            <div>
              <FieldLabel>¿Realizás actividad física?</FieldLabel>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="no" className="accent-zinc-600 dark:accent-zinc-500" {...register('has_physical_activity')} />
                  No
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="si" className="accent-zinc-600 dark:accent-zinc-500" {...register('has_physical_activity')} />
                  Sí
                </label>
              </div>
            </div>

            {hasActivity === 'si' && (
              <>
                <div>
                  <FieldLabel>¿Cuál / cuáles?</FieldLabel>
                  <input type="text" className={inputClass()} placeholder="ej: fútbol, musculación, caminatas..." {...register('activity_type')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>¿Hace cuánto tiempo?</FieldLabel>
                    <input type="text" className={inputClass()} placeholder="ej: 6 meses" {...register('activity_since')} />
                  </div>
                  <div>
                    <FieldLabel>Frecuencia</FieldLabel>
                    <input type="text" className={inputClass()} placeholder="ej: 3 veces/semana" {...register('activity_frequency')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Duración por sesión</FieldLabel>
                    <input type="text" className={inputClass()} placeholder="ej: 1 hora" {...register('activity_duration')} />
                  </div>
                  <div>
                    <FieldLabel>Intensidad</FieldLabel>
                    <select className={cn(inputClass(), 'cursor-pointer')} {...register('activity_intensity')}>
                      <option value="">Seleccioná...</option>
                      <option value="baja">Baja</option>
                      <option value="moderada">Moderada</option>
                      <option value="alta">Alta</option>
                      <option value="muy_alta">Muy alta</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="border-t border-surface-border pt-4 mt-2">
              <p className="text-sm font-semibold text-ink-primary mb-3">Hábitos alimentarios</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Horario primera ingesta</FieldLabel>
                <input type="text" className={inputClass()} placeholder="ej: 7:30hs" {...register('first_meal_time')} />
              </div>
              <div>
                <FieldLabel>Horario última ingesta</FieldLabel>
                <input type="text" className={inputClass()} placeholder="ej: 22hs" {...register('last_meal_time')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Comidas por día</FieldLabel>
                <input type="text" className={inputClass()} placeholder="ej: 4" {...register('meals_per_day')} />
              </div>
              <div>
                <FieldLabel>Comida que solés saltear</FieldLabel>
                <input type="text" className={inputClass()} placeholder="ej: desayuno" {...register('skipped_meal')} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <label className={intakeFormFieldLabelInlineClass()}>Intolerancias digestivas</label>
                <IntakeQuickTextFill
                  fillValue="Ninguna"
                  onFill={(t) =>
                    setValue('digestive_intolerances', t, { shouldValidate: true, shouldDirty: true })
                  }
                />
              </div>
              <input type="text" className={inputClass()} placeholder="ej: lactosa, gluten... o ninguna" {...register('digestive_intolerances')} />
            </div>

            <div>
              <FieldLabel>7 preparaciones más comunes que consumís</FieldLabel>
              <textarea rows={4} className={taClass()} placeholder="ej: milanesas, arroz con pollo, ensaladas, pasta..." {...register('common_preparations')} />
            </div>
          </>
        )}

        {/* ── Paso 3: Registro alimentario 24hs ────────────────────────────── */}
        {step === 3 && (
          <>
            <p className="text-xs text-ink-secondary leading-relaxed bg-surface-elevated rounded-xl px-4 py-3">
              Anotá todo lo que comiste <span className="font-semibold">ayer</span>, lo más detallado posible con cantidades aproximadas y líquidos.
            </p>

            {([
              { field: 'record_breakfast' as const,  label: 'Desayuno',    ph: 'ej: café con leche + 2 tostadas con manteca...' },
              { field: 'record_lunch' as const,      label: 'Almuerzo',    ph: 'ej: milanesa con puré, agua, manzana...' },
              { field: 'record_snack' as const,      label: 'Merienda',    ph: 'ej: yogur + fruta...' },
              { field: 'record_dinner' as const,     label: 'Cena',        ph: 'ej: sopa de verduras + pan...' },
              { field: 'record_collations' as const, label: 'Colaciones',  ph: 'ej: frutos secos, fruta... o ninguna' },
            ]).map(({ field, label, ph }) => (
              <div key={field}>
                {field === 'record_collations' ? (
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <label className={intakeFormFieldLabelInlineClass()}>{label}</label>
                    <IntakeQuickTextFill
                      fillValue="Ninguna"
                      onFill={(t) =>
                        setValue('record_collations', t, { shouldValidate: true, shouldDirty: true })
                      }
                    />
                  </div>
                ) : (
                  <FieldLabel>{label}</FieldLabel>
                )}
                <textarea rows={3} className={taClass()} placeholder={ph} {...register(field)} />
              </div>
            ))}
          </>
        )}

        {/* ── Paso 4: Frecuencia alimentaria + hábitos + foto ──────────────── */}
        {step === 4 && (
          <>
            {/* Tabla de frecuencia */}
            <div>
              <p className="text-sm font-semibold text-ink-primary mb-1">Frecuencia alimentaria</p>
              <p className="text-xs text-ink-muted mb-3">
                Indicá <strong>Tipo</strong> (ej: descremado, aceite de oliva, etc.) y <strong>Frecuencia</strong> (Diario, Semanal, Quincenal, Mensual o X si no consumís).
              </p>
            </div>

            <div className="rounded-xl border border-surface-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_90px_90px] gap-px bg-surface-border">
                <div className="bg-surface-elevated px-3 py-2 text-[10px] font-semibold text-ink-muted uppercase tracking-wide">Alimento</div>
                <div className="bg-surface-elevated px-2 py-2 text-[10px] font-semibold text-ink-muted uppercase tracking-wide text-center">Frecuencia</div>
                <div className="bg-surface-elevated px-2 py-2 text-[10px] font-semibold text-ink-muted uppercase tracking-wide text-center">Tipo / detalle</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-surface-border">
                {FOOD_ITEMS.map((food) => (
                  <div key={food.key} className="grid grid-cols-[1fr_90px_90px] gap-px bg-surface-border">
                    <div className="bg-surface-card px-3 py-2 flex items-center">
                      <span className="text-xs text-ink-secondary">{food.label}</span>
                    </div>
                    <div className="bg-surface-card px-1 py-1.5 flex items-center">
                      <select
                        className="w-full bg-surface-elevated text-ink-primary text-[11px] rounded-lg px-1.5 py-1.5 border border-surface-border focus:border-zinc-400 dark:focus:border-zinc-500 outline-none cursor-pointer"
                        {...register(`food_freq.${food.key}.frecuencia`)}
                      >
                        {FREQ_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o || '—'}</option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-surface-card px-1 py-1.5 flex items-center">
                      <input
                        type="text"
                        placeholder="—"
                        className="w-full bg-surface-elevated text-ink-primary text-[11px] rounded-lg px-2 py-1.5 border border-surface-border focus:border-zinc-400 dark:focus:border-zinc-500 outline-none placeholder:text-ink-muted"
                        {...register(`food_freq.${food.key}.tipo`)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Otros alimentos */}
            <div>
              <FieldLabel>Otros alimentos que consumís y querés informar</FieldLabel>
              <textarea rows={2} className={taClass()} placeholder="Cualquier alimento no listado..." {...register('other_notes')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Verduras que consumís con más frecuencia</FieldLabel>
                <textarea rows={3} className={taClass()} placeholder="ej: zanahoria, tomate, espinaca..." {...register('frequent_vegetables')} />
              </div>
              <div>
                <FieldLabel>Frutas que consumís con más frecuencia</FieldLabel>
                <textarea rows={3} className={taClass()} placeholder="ej: banana, manzana, naranja..." {...register('frequent_fruits')} />
              </div>
            </div>

            {/* Buenos y malos hábitos */}
            <div className="border-t border-surface-border pt-4">
              <p className="text-sm font-semibold text-ink-primary mb-1">Buenos y malos hábitos</p>
              <p className="text-xs text-ink-muted mb-3">No tienen que ser de alimentación, lo que se te ocurra.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-emerald-400">Buenos hábitos</p>
                  <input type="text" className={inputClass()} placeholder="Hábito bueno 1" {...register('good_habit_1')} />
                  <input type="text" className={inputClass()} placeholder="Hábito bueno 2" {...register('good_habit_2')} />
                  <input type="text" className={inputClass()} placeholder="Hábito bueno 3" {...register('good_habit_3')} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-status-expired">Malos hábitos</p>
                  <input type="text" className={inputClass()} placeholder="Hábito malo 1" {...register('bad_habit_1')} />
                  <input type="text" className={inputClass()} placeholder="Hábito malo 2" {...register('bad_habit_2')} />
                  <input type="text" className={inputClass()} placeholder="Hábito malo 3" {...register('bad_habit_3')} />
                </div>
              </div>
            </div>

            {/* Foto para registro */}
            <div className="border-t border-surface-border pt-4">
              <FieldLabel>Foto de perfil para el registro (opcional)</FieldLabel>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface-elevated/40 px-2.5 py-2 transition-colors hover:border-zinc-400/50 hover:bg-zinc-500/[0.06] dark:hover:border-white/20 dark:hover:bg-white/[0.04]">
                {profilePreview ? (
                  <img src={profilePreview} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className={intakeAttachPlusBox()} aria-hidden>+</span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">
                  {profileFile ? profileFile.name : 'Elegir foto'}
                </span>
                {profileFile && (
                  <button
                    type="button"
                    aria-label="Quitar foto"
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-muted hover:bg-surface-border/50 hover:text-ink-secondary"
                    onClick={(e) => {
                      e.preventDefault()
                      if (profilePreview) URL.revokeObjectURL(profilePreview)
                      setProfileFile(null)
                      setProfilePreview(null)
                    }}
                  >
                    ×
                  </button>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    if (f && f.size > MAX_BYTES) {
                      toast.error('Máximo 10 MB')
                      return
                    }
                    if (profilePreview) URL.revokeObjectURL(profilePreview)
                    setProfileFile(f)
                    setProfilePreview(f ? URL.createObjectURL(f) : null)
                  }}
                />
              </label>
            </div>

            <input type="text" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden {...register('website')} />
          </>
        )}

        {/* ── Paso 5: Pago ───────────────────────────────────────────────── */}
        {step === 5 && (
          <>
            <IntakePaymentPreferenceFields register={register} error={errors.payment_preference?.message} />

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-surface-border bg-surface-input accent-zinc-600 focus:ring-2 focus:ring-offset-0 focus:ring-offset-surface-card dark:accent-zinc-500"
                {...register('accept_privacy')}
              />
              <span className="text-sm text-ink-secondary leading-snug">
                Acepto el envío de mis datos según la política del estudio. Entiendo que se usarán para la elaboración de mi plan nutricional personalizado.
              </span>
            </label>
            {errors.accept_privacy?.message && (
              <p className="text-xs text-status-expired">{errors.accept_privacy.message}</p>
            )}

            <input type="text" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden {...register('website')} />
          </>
        )}

        <IntakeFormStepActions
          step={step}
          stepCount={STEP_TITLES.length}
          onBack={() => setStep((s) => s - 1)}
          onNext={() => void goNext()}
          isSubmitting={isSubmitting}
        />

        <p className="pt-3 text-center text-[10px] text-ink-muted/80">Plan nutricional · Haciéndolo hábito</p>
        </form>
      </IntakeFormShell>
    </div>
  )
}

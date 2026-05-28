/**
 * IntakeFullForm — formulario unificado para el Plan Full (entrenador + nutricionista).
 * Combina los campos de IntakeFersterForm e IntakeNutritionForm en un solo flujo multi-paso.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { canonicalizeArgentinaStudentPhone, STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
import toast from 'react-hot-toast'
import { compressImageFileForUpload } from '@/lib/compressImageForUpload'
import {
  intakeAttachPlusBox,
  intakeFormFieldLabelClass,
  intakeFormFieldLabelInlineClass,
  intakeFormInputClass,
  intakeFormPageContainerClass,
} from '@/lib/intake/intakeFormUi'
import { IntakeFormStepNav } from '@/components/public/intake/IntakeFormStepNav'
import { IntakeGenderField } from '@/components/public/intake/IntakeGenderField'
import { IntakeFormPlanHint } from '@/components/public/intake/IntakeFormPlanHint'
import { IntakeFormShell } from '@/components/public/intake/IntakeFormShell'
import { IntakeFormStepActions } from '@/components/public/intake/IntakeFormStepActions'
import { IntakeFormReviewStrip } from '@/components/public/intake/IntakeFormReviewStrip'
import { IntakePaymentPreferenceFields } from '@/components/public/IntakePaymentPreferenceFields'
import { IntakeQuickTextFill } from '@/components/public/IntakeQuickTextFill'
import type { IntakeProfessional } from '@/lib/intake/intakeProfessionals'
import { submitPublicIntake } from '@/lib/intake/submitPublicIntake'

const MAX_BYTES = 10 * 1024 * 1024
const PHONE_HINT = `Formato: ${STUDENT_PHONE_FORMAT_HINT}`

// ── Schema ────────────────────────────────────────────────────────────────────

const fullIntakeSchema = z
  .object({
    // Personal (shared)
    first_name: z.string().min(1, 'Requerido').max(60),
    last_name: z.string().min(1, 'Requerido').max(60),
    document_id: z.string().min(4, 'Documento inválido').max(32),
    phone: z.string().min(1, 'Teléfono requerido'),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    gender: z.enum(['M', 'F', 'otro']),
    gender_other: z.string().max(120).optional().or(z.literal('')),
    weight_kg: z.coerce.number().min(25, 'Peso inválido').max(400),
    height_cm: z.coerce.number().min(100, 'Altura inválida').max(250),
    email: z.string().email('Email inválido'),
    address: z.string().min(8, 'Indicá una dirección más completa').max(500),
    // Training (Ferster)
    training_since: z.enum(['never', 'less_than_1y', '1_to_3y', 'more_than_3y']),
    days_per_week: z.coerce.number().int().min(1).max(10),
    lifestyle: z.enum(['sedentary', 'light', 'active', 'very_active']),
    training_intensity: z.enum(['light', 'moderate', 'intense', 'very_intense']),
    session_duration: z.enum(['30', '60', '90', '120_plus']),
    equipment: z.enum(['none', 'home', 'gym_basic', 'gym_advanced']),
    main_goal: z.enum(['healthy_life', 'sport', 'cut_lean', 'bulk']),
    // Health (shared between both)
    pathology: z.enum(['no', 'yes']),
    pathology_detail: z.string().max(2000).optional().or(z.literal('')),
    discomfort_exercises: z.string().min(1, 'Respondé esta pregunta').max(2000),
    four_meals: z.enum(['yes', 'no', 'rarely']),
    sleep_hours: z.enum(['lt5', '5_6', '6_7', '8_plus']),
    supplements: z.enum(['yes', 'no']),
    // Nutrition extras (Cristian)
    motivo_consulta: z.string().max(2000).optional().or(z.literal('')),
    pathologies: z.string().max(2000).optional().or(z.literal('')),
    medications: z.string().max(2000).optional().or(z.literal('')),
    symptoms: z.string().max(2000).optional().or(z.literal('')),
    digestive_intolerances: z.string().max(500).optional().or(z.literal('')),
    meals_per_day: z.string().max(20).optional().or(z.literal('')),
    first_meal_time: z.string().max(50).optional().or(z.literal('')),
    last_meal_time: z.string().max(50).optional().or(z.literal('')),
    common_preparations: z.string().max(2000).optional().or(z.literal('')),
    payment_preference: z.enum(['cash', 'mercadopago'], {
      required_error: 'Elegí una forma de pago',
    }),
    payment_notes: z.string().max(500).optional().or(z.literal('')),
    // Privacy
    accept_privacy: z.boolean().refine((v) => v === true, { message: 'Tenés que aceptar para continuar' }),
    website: z.literal(''),
  })
  .superRefine((data, ctx) => {
    if (!canonicalizeArgentinaStudentPhone(data.phone)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Formato: ${STUDENT_PHONE_FORMAT_HINT}`, path: ['phone'] })
    }
    if (data.gender === 'otro' && !data.gender_other?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Completá el género', path: ['gender_other'] })
    }
    if (data.pathology === 'yes' && !data.pathology_detail?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Describí la patología o medicación', path: ['pathology_detail'] })
    }
  })

type FullIntakeFormValues = z.infer<typeof fullIntakeSchema>

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEP_FIELDS: (keyof FullIntakeFormValues)[][] = [
  ['first_name', 'last_name', 'document_id', 'phone', 'birth_date', 'gender', 'gender_other', 'weight_kg', 'height_cm', 'email', 'address'],
  ['training_since', 'days_per_week', 'lifestyle', 'training_intensity', 'session_duration', 'equipment', 'main_goal'],
  ['pathology', 'pathology_detail', 'discomfort_exercises', 'four_meals', 'sleep_hours', 'supplements'],
  [],
  [],
  ['payment_preference', 'payment_notes', 'accept_privacy'],
]

const STEP_TITLES = ['Datos', 'Entreno', 'Salud', 'Nutrición', 'Fotos', 'Pago']

// ── Helpers ───────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className={intakeFormFieldLabelClass()}>
      {children}
      {required ? <span className="text-zinc-500 dark:text-zinc-400">*</span> : null}
    </label>
  )
}

const inputClass = intakeFormInputClass

function formatArgPhoneInput(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (!trimmed) return trimmed
  if (trimmed.startsWith('+') && trimmed.includes(' ')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed
  let rest = digits
  if (digits.startsWith('54')) rest = digits.slice(2)
  else if (digits.startsWith('0')) rest = digits.slice(1)
  if (!rest) return '+54'
  if (rest.length <= 2) return `+54 ${rest}`
  return `+54 ${rest.slice(0, 2)} ${rest.slice(2)}`
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  onSuccess: () => void
  selectedPlanSlug?: string | null
  selectedPlanLabel?: string | null
  selectedPlanPrice?: string | null
  selectedTrainer?: IntakeProfessional | null
  selectedNutritionist?: IntakeProfessional | null
  compact?: boolean
  onRequestChangePlan?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IntakeFullForm({
  onSuccess,
  selectedPlanSlug = null,
  selectedPlanLabel = null,
  selectedPlanPrice = null,
  selectedTrainer = null,
  selectedNutritionist = null,
  compact = false,
  onRequestChangePlan,
}: Props) {
  const trainerName = selectedTrainer?.fullName ?? 'tu entrenador'
  const nutritionistName = selectedNutritionist?.fullName ?? 'tu nutricionista'
  const [step, setStep] = useState(0)
  const [stepNavHint, setStepNavHint] = useState<string | null>(null)
  const [phoneFocused, setPhoneFocused] = useState(false)
  const stepNavHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [progressFiles, setProgressFiles] = useState<File[]>([])
  const [progressPreviews, setProgressPreviews] = useState<string[]>([])
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [medicalFile, setMedicalFile] = useState<File | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FullIntakeFormValues>({
    resolver: zodResolver(fullIntakeSchema),
    defaultValues: {
      website: '',
      accept_privacy: false,
      first_name: '', last_name: '', document_id: '', phone: '', birth_date: '',
      gender: 'M', gender_other: '', weight_kg: 70, height_cm: 170,
      email: '', address: '',
      training_since: 'never', days_per_week: 3, lifestyle: 'sedentary',
      training_intensity: 'moderate', session_duration: '60', equipment: 'gym_basic',
      main_goal: 'healthy_life',
      pathology: 'no', pathology_detail: '', discomfort_exercises: '',
      four_meals: 'yes', sleep_hours: '6_7', supplements: 'no',
      motivo_consulta: '', pathologies: '', medications: '', symptoms: '',
      digestive_intolerances: '', meals_per_day: '', first_meal_time: '', last_meal_time: '',
      common_preparations: '',
      payment_preference: 'mercadopago',
      payment_notes: '',
    },
  })

  const pathology = watch('pathology')
  const gender = watch('gender')
  const watchedFirstName = watch('first_name')
  const watchedLastName = watch('last_name')
  const watchedPhone = watch('phone')

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  useEffect(() => {
    return () => {
      progressPreviews.forEach((u) => URL.revokeObjectURL(u))
      if (profilePreview) URL.revokeObjectURL(profilePreview)
    }
  }, [progressPreviews, profilePreview])

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

  const handleProgressFiles = useCallback((files: FileList | null) => {
    const list = Array.from(files ?? []).slice(0, 5)
    setProgressFiles(list)
    progressPreviews.forEach((u) => URL.revokeObjectURL(u))
    setProgressPreviews(list.map((f) => URL.createObjectURL(f)))
  }, [progressPreviews])

  const handleProfileFile = useCallback((file: File | null) => {
    if (profilePreview) URL.revokeObjectURL(profilePreview)
    setProfileFile(file)
    setProfilePreview(file ? URL.createObjectURL(file) : null)
  }, [profilePreview])

  async function goNext() {
    const fields = STEP_FIELDS[step]
    if (fields.length === 0) {
      setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1))
      return
    }
    const ok = await trigger(fields, { shouldFocus: true })
    if (ok) setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1))
  }

  /** Misma regla que «Siguiente»: no saltar pestañas hacia adelante sin validar pasos intermedios. */
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

  async function onSubmit(values: FullIntakeFormValues) {
    const phone = canonicalizeArgentinaStudentPhone(values.phone)
    if (!phone) return

    for (const f of [...progressFiles, ...(profileFile ? [profileFile] : []), ...(medicalFile ? [medicalFile] : [])]) {
      if (f.size > MAX_BYTES) { toast.error(`${f.name}: máximo 10 MB`); return }
    }
    if (progressFiles.length > 5) { toast.error('Como máximo 5 fotos corporales.'); return }

    const payload = {
      ...values,
      phone,
      form_type: 'full',
      selected_plan_slug: selectedPlanSlug,
      intake_trainer_slug: selectedTrainer?.slug ?? '',
      intake_nutritionist_slug: selectedNutritionist?.slug ?? '',
    }

    const hasFiles = progressFiles.length > 0 || profileFile !== null || medicalFile !== null
    let submitFiles: { progress?: File[]; profile?: File | null; medical?: File | null } | undefined
    if (hasFiles) {
      const compressedProgress = await Promise.all(progressFiles.map((f) => compressImageFileForUpload(f)))
      const profilePrepared = profileFile ? await compressImageFileForUpload(profileFile) : null
      const medicalPrepared =
        medicalFile && medicalFile.type.startsWith('image/')
          ? await compressImageFileForUpload(medicalFile)
          : medicalFile
      submitFiles = {
        progress: compressedProgress,
        profile: profilePrepared,
        medical: medicalPrepared,
      }
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
    <div ref={scrollRef} className={intakeFormPageContainerClass()}>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4">
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
            <div>
              <FieldLabel required>Documento</FieldLabel>
              <input type="text" className={inputClass(errors.document_id?.message)} {...register('document_id')} />
              {errors.document_id?.message && <p className="mt-1 text-xs text-status-expired">{errors.document_id.message}</p>}
            </div>
            <div>
              <FieldLabel required>Fecha de nacimiento</FieldLabel>
              <input type="date" className={inputClass(errors.birth_date?.message)} {...register('birth_date')} />
              {errors.birth_date?.message && <p className="mt-1 text-xs text-status-expired">{errors.birth_date.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <IntakeGenderField register={register} gender={gender} errors={errors} inputClass={inputClass} />
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
                    const formatted = formatArgPhoneInput(e.target.value)
                    if (formatted !== e.target.value) setValue('phone', formatted, { shouldValidate: true })
                  },
                })}
              />
              {errors.phone?.message ? (
                <p className="mt-1 text-xs text-status-expired">{errors.phone.message}</p>
              ) : phoneFocused ? (
                <p className="mt-1 text-xs text-ink-muted">{PHONE_HINT}</p>
              ) : null}
            </div>
            <div>
              <FieldLabel required>Correo electrónico</FieldLabel>
              <input type="email" autoComplete="email" className={inputClass(errors.email?.message)} {...register('email')} />
              {errors.email?.message && <p className="mt-1 text-xs text-status-expired">{errors.email.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <FieldLabel required>Dirección completa</FieldLabel>
              <textarea rows={2} className={cn(inputClass(errors.address?.message), 'resize-y min-h-[72px]')} {...register('address')} />
              {errors.address?.message && <p className="mt-1 text-xs text-status-expired">{errors.address.message}</p>}
            </div>
            <div>
              <FieldLabel required>Peso (kg)</FieldLabel>
              <input type="number" step="0.1" inputMode="decimal" className={inputClass(errors.weight_kg?.message)} {...register('weight_kg', { valueAsNumber: true })} />
              {errors.weight_kg?.message && <p className="mt-1 text-xs text-status-expired">{String(errors.weight_kg.message)}</p>}
            </div>
            <div>
              <FieldLabel required>Altura (cm)</FieldLabel>
              <input type="number" inputMode="numeric" className={inputClass(errors.height_cm?.message)} {...register('height_cm', { valueAsNumber: true })} />
              {errors.height_cm?.message && <p className="mt-1 text-xs text-status-expired">{String(errors.height_cm.message)}</p>}
            </div>
          </div>
        )}

        {/* ── PASO 1: Entrenamiento (Tomás Ferster) ── */}
        {step === 1 && (
          <>
            <p className="mb-1 text-sm text-ink-muted">
              Entrenamiento · <span className="font-medium text-ink-primary">{trainerName}</span>
            </p>
            <div>
              <FieldLabel required>¿Hace cuánto entrenás?</FieldLabel>
              <select className={cn(inputClass(), 'cursor-pointer')} {...register('training_since')}>
                <option value="never">No entrenaba</option>
                <option value="less_than_1y">Hace menos de 1 año</option>
                <option value="1_to_3y">Entre 1 y 3 años</option>
                <option value="more_than_3y">Más de 3 años</option>
              </select>
            </div>
            <div>
              <FieldLabel required>¿Cuántos días podés entrenar?</FieldLabel>
              <select className={cn(inputClass(), 'cursor-pointer')} {...register('days_per_week', { valueAsNumber: true })}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} x semana</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel required>¿Cómo calificarías tu estilo de vida?</FieldLabel>
              <select className={cn(inputClass(), 'cursor-pointer')} {...register('lifestyle')}>
                <option value="sedentary">Sedentario</option>
                <option value="light">Poco activo</option>
                <option value="active">Activo</option>
                <option value="very_active">Muy activo</option>
              </select>
            </div>
            <div>
              <FieldLabel required>Nivel de intensidad de entrenamiento</FieldLabel>
              <select className={cn(inputClass(), 'cursor-pointer')} {...register('training_intensity')}>
                <option value="light">Liviano</option>
                <option value="moderate">Moderado</option>
                <option value="intense">Intenso</option>
                <option value="very_intense">Muy intenso</option>
              </select>
            </div>
            <div>
              <FieldLabel required>¿Cuánto tiempo tenés para entrenar?</FieldLabel>
              <select className={cn(inputClass(), 'cursor-pointer')} {...register('session_duration')}>
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1,5 horas</option>
                <option value="120_plus">2 horas o más</option>
              </select>
            </div>
            <div>
              <FieldLabel required>¿Qué equipo tenés disponible?</FieldLabel>
              <select className={cn(inputClass(), 'cursor-pointer')} {...register('equipment')}>
                <option value="none">Sin equipo</option>
                <option value="home">Equipo en casa</option>
                <option value="gym_basic">Gimnasio básico</option>
                <option value="gym_advanced">Gimnasio avanzado</option>
              </select>
            </div>
            <div>
              <FieldLabel required>Objetivo principal</FieldLabel>
              <select className={cn(inputClass(), 'cursor-pointer')} {...register('main_goal')}>
                <option value="healthy_life">Vida saludable</option>
                <option value="sport">Mejorar en mi deporte</option>
                <option value="cut_lean">Descenso de peso y ganancia magra</option>
                <option value="bulk">Aumento de masa muscular</option>
              </select>
            </div>
          </>
        )}

        {/* ── PASO 2: Salud y hábitos (compartido) ── */}
        {step === 2 && (
          <>
            <div>
              <FieldLabel required>¿Patología o medicamentos?</FieldLabel>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="no" className="accent-zinc-600 dark:accent-zinc-500" {...register('pathology')} />No
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="yes" className="accent-zinc-600 dark:accent-zinc-500" {...register('pathology')} />
                  Sí (detallar abajo)
                </label>
              </div>
            </div>
            {pathology === 'yes' && (
              <div>
                <FieldLabel required>Detalle de patología / medicación</FieldLabel>
                <textarea rows={3} className={cn(inputClass(errors.pathology_detail?.message), 'resize-y min-h-[88px]')} {...register('pathology_detail')} />
                {errors.pathology_detail?.message && <p className="mt-1 text-xs text-status-expired">{errors.pathology_detail.message}</p>}
              </div>
            )}
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <label className={intakeFormFieldLabelInlineClass()}>
                  ¿Algún ejercicio que te incomode o no puedas hacer?
                  <span className="text-status-expired ml-0.5">*</span>
                </label>
                <IntakeQuickTextFill
                  onFill={(t) =>
                    setValue('discomfort_exercises', t, { shouldValidate: true, shouldDirty: true })
                  }
                />
              </div>
              <textarea rows={2} className={cn(inputClass(errors.discomfort_exercises?.message), 'resize-y min-h-[72px]')} placeholder="Ej.: Ninguno / evito impacto en rodilla…" {...register('discomfort_exercises')} />
              {errors.discomfort_exercises?.message && <p className="mt-1 text-xs text-status-expired">{errors.discomfort_exercises.message}</p>}
            </div>
            <div>
              <FieldLabel required>¿Respetás tus 4 comidas al día?</FieldLabel>
              <select className={cn(inputClass(), 'cursor-pointer')} {...register('four_meals')}>
                <option value="yes">Sí</option>
                <option value="no">No</option>
                <option value="rarely">Con poca frecuencia</option>
              </select>
            </div>
            <div>
              <FieldLabel required>¿Cuántas horas dormís habitualmente?</FieldLabel>
              <select className={cn(inputClass(), 'cursor-pointer')} {...register('sleep_hours')}>
                <option value="lt5">Menos de 5</option>
                <option value="5_6">5 a 6 horas</option>
                <option value="6_7">6 a 7 horas</option>
                <option value="8_plus">8 horas o más</option>
              </select>
            </div>
            <div>
              <FieldLabel required>¿Consumís suplementos?</FieldLabel>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="no" className="accent-zinc-600 dark:accent-zinc-500" {...register('supplements')} />No
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="yes" className="accent-zinc-600 dark:accent-zinc-500" {...register('supplements')} />Sí
                </label>
              </div>
            </div>
          </>
        )}

        {/* ── PASO 3: Nutrición (Cristian Crossetto) ── */}
        {step === 3 && (
          <>
            <p className="mb-1 text-sm text-ink-muted">
              Nutrición · <span className="font-medium text-ink-primary">{nutritionistName}</span>
            </p>
            <div>
              <FieldLabel>Motivo de consulta nutricional</FieldLabel>
              <textarea rows={3} className={cn(inputClass(), 'resize-y min-h-[88px]')} placeholder="¿Por qué buscás asesoramiento nutricional?" {...register('motivo_consulta')} />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <label className={intakeFormFieldLabelInlineClass()}>Patologías presentes</label>
                <IntakeQuickTextFill
                  fillValue="Ninguna"
                  onFill={(t) => setValue('pathologies', t, { shouldValidate: true, shouldDirty: true })}
                />
              </div>
              <textarea rows={2} className={cn(inputClass(), 'resize-y min-h-[72px]')} placeholder="ej: hipotiroidismo, diabetes... o ninguna" {...register('pathologies')} />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <label className={intakeFormFieldLabelInlineClass()}>Medicación que tomás</label>
                <IntakeQuickTextFill
                  fillValue="Ninguna"
                  onFill={(t) => setValue('medications', t, { shouldValidate: true, shouldDirty: true })}
                />
              </div>
              <textarea rows={2} className={cn(inputClass(), 'resize-y min-h-[72px]')} placeholder="Nombre y dosis, o ninguna" {...register('medications')} />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <label className={intakeFormFieldLabelInlineClass()}>Síntomas digestivos</label>
                <IntakeQuickTextFill
                  onFill={(t) => setValue('symptoms', t, { shouldValidate: true, shouldDirty: true })}
                />
              </div>
              <textarea rows={2} className={cn(inputClass(), 'resize-y min-h-[72px]')} placeholder="Hinchazón, acidez, etc. o ninguno" {...register('symptoms')} />
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
            <div>
              <FieldLabel>Comidas por día</FieldLabel>
              <input type="text" className={inputClass()} placeholder="ej: 4" {...register('meals_per_day')} />
            </div>
            <div>
              <FieldLabel>7 preparaciones más comunes que consumís</FieldLabel>
              <textarea rows={3} className={cn(inputClass(), 'resize-y min-h-[88px]')} placeholder="ej: milanesas, arroz con pollo, ensaladas..." {...register('common_preparations')} />
            </div>
          </>
        )}

        {/* ── PASO 4: Fotos y envío ── */}
        {step === 4 && (
          <>
            <IntakeFormReviewStrip
              firstName={watchedFirstName}
              lastName={watchedLastName}
              phone={watchedPhone}
              planLabel={selectedPlanLabel}
              planPrice={selectedPlanPrice}
            />

            <p className="text-[11px] leading-snug text-ink-muted">
              Fotos y estudios opcionales. Hasta 5 imágenes, 10 MB c/u.
            </p>

            {/* Medical file */}
            <div>
              <FieldLabel>Estudios médicos / análisis (PDF o imagen, opcional)</FieldLabel>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface-elevated/40 px-2.5 py-2 transition-colors hover:border-zinc-400/50 hover:bg-zinc-500/[0.06] dark:hover:border-white/20 dark:hover:bg-white/[0.04]">
                <span className={intakeAttachPlusBox()} aria-hidden>+</span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">{medicalFile ? medicalFile.name : 'Elegir archivo'}</span>
                {medicalFile && (
                  <button
                    type="button"
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-muted hover:bg-surface-border/50 hover:text-ink-secondary"
                    aria-label="Quitar archivo"
                    onClick={(e) => {
                      e.preventDefault()
                      setMedicalFile(null)
                    }}
                  >
                    ×
                  </button>
                )}
                <input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => setMedicalFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            {/* Progress photos */}
            <div>
              <FieldLabel>Fotografías corporales (opcional, hasta 5)</FieldLabel>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface-elevated/40 px-2.5 py-2 transition-colors hover:border-zinc-400/50 hover:bg-zinc-500/[0.06] dark:hover:border-white/20 dark:hover:bg-white/[0.04]">
                <span className={intakeAttachPlusBox()} aria-hidden>+</span>
                <span className="text-xs text-ink-secondary">
                  {progressFiles.length > 0 ? `${progressFiles.length} foto(s)` : 'Elegir fotos'}
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => handleProgressFiles(e.target.files)} />
              </label>
              {progressPreviews.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {progressPreviews.map((src, idx) => (
                    <div key={src} className="relative h-14 w-14 overflow-hidden rounded-md border border-surface-border">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Quitar foto"
                        className="absolute right-0 top-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-bl bg-black/65 px-1 text-xs text-white hover:bg-black/80"
                        onClick={() => {
                          const next = progressFiles.filter((_, i) => i !== idx)
                          URL.revokeObjectURL(src)
                          setProgressFiles(next)
                          setProgressPreviews((p) => p.filter((_, i) => i !== idx))
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profile photo */}
            <div>
              <FieldLabel>Foto de perfil para el registro (opcional)</FieldLabel>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface-elevated/40 px-2.5 py-2 transition-colors hover:border-zinc-400/50 hover:bg-zinc-500/[0.06] dark:hover:border-white/20 dark:hover:bg-white/[0.04]">
                {profilePreview ? (
                  <img src={profilePreview} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className={intakeAttachPlusBox()} aria-hidden>+</span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">{profileFile ? profileFile.name : 'Elegir foto'}</span>
                {profileFile && (
                  <button
                    type="button"
                    aria-label="Quitar foto de perfil"
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-muted hover:bg-surface-border/50 hover:text-ink-secondary"
                    onClick={(e) => {
                      e.preventDefault()
                      handleProfileFile(null)
                    }}
                  >
                    ×
                  </button>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => handleProfileFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <input type="text" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden {...register('website')} />
          </>
        )}

        {/* ── PASO 5: Pago y envío ── */}
        {step === 5 && (
          <>
            <IntakePaymentPreferenceFields register={register} error={errors.payment_preference?.message} />

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-surface-border bg-surface-input accent-zinc-600 focus:ring-2 focus:ring-offset-0 dark:accent-zinc-500"
                {...register('accept_privacy')}
              />
              <span className="text-sm text-ink-secondary leading-snug">
                Acepto el envío de mis datos y archivos según la política del estudio. Entiendo que los datos se usan para el plan de entrenamiento y nutricional personalizado con ambos profesionales.
              </span>
            </label>
            {errors.accept_privacy?.message && <p className="text-xs text-status-expired">{errors.accept_privacy.message}</p>}
            <input type="text" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden {...register('website')} />
          </>
        )}

        <IntakeFormStepActions
          step={step}
          stepCount={STEP_FIELDS.length}
          onBack={() => setStep((s) => s - 1)}
          onNext={() => void goNext()}
          isSubmitting={isSubmitting}
        />

        </form>
      </IntakeFormShell>
    </div>
  )
}

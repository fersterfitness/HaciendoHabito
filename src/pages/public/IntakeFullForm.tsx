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
  intakeFormCtaButtonClass,
  intakeFormFieldLabelClass,
  intakeFormInputClass,
  intakePublicSelectedPlanBarClass,
} from '@/lib/intake/intakeFormUi'
import { IntakePaymentPreferenceFields } from '@/components/public/IntakePaymentPreferenceFields'

const MAX_BYTES = 10 * 1024 * 1024
const PHONE_HINT = `Formato: ${STUDENT_PHONE_FORMAT_HINT}`

const intakeSecret =
  typeof import.meta.env.VITE_PUBLIC_INTAKE_SECRET === 'string'
    ? import.meta.env.VITE_PUBLIC_INTAKE_SECRET
    : ''

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
  ['payment_preference', 'accept_privacy'],
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
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IntakeFullForm({ onSuccess, selectedPlanSlug = null, selectedPlanLabel = null, selectedPlanPrice = null }: Props) {
  const [step, setStep] = useState(0)
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
    },
  })

  const pathology = watch('pathology')
  const gender = watch('gender')
  const watchedFirstName = watch('first_name')
  const watchedLastName = watch('last_name')
  const watchedEmail = watch('email')
  const watchedPhone = watch('phone')

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    const parent = scrollRef.current?.closest('.overflow-y-auto')
    if (parent) parent.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  useEffect(() => {
    return () => {
      progressPreviews.forEach((u) => URL.revokeObjectURL(u))
      if (profilePreview) URL.revokeObjectURL(profilePreview)
    }
  }, [progressPreviews, profilePreview])

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

  async function onSubmit(values: FullIntakeFormValues) {
    const phone = canonicalizeArgentinaStudentPhone(values.phone)
    if (!phone) return

    for (const f of [...progressFiles, ...(profileFile ? [profileFile] : []), ...(medicalFile ? [medicalFile] : [])]) {
      if (f.size > MAX_BYTES) { toast.error(`${f.name}: máximo 10 MB`); return }
    }
    if (progressFiles.length > 5) { toast.error('Como máximo 5 fotos corporales.'); return }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    if (!supabaseUrl || !anon) { toast.error('Falta configuración del sitio'); return }

    const payload = {
      ...values, phone,
      form_type: 'full',
      selected_plan_slug: selectedPlanSlug,
    }

    const endpoint = `${supabaseUrl}/functions/v1/public-intake-form`
    const fnHeaders: Record<string, string> = { apikey: anon, Authorization: `Bearer ${anon}` }
    if (intakeSecret) fnHeaders['x-intake-secret'] = intakeSecret

    const hasFiles = progressFiles.length > 0 || profileFile !== null || medicalFile !== null
    let res: Response
    try {
      if (!hasFiles) {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { ...fnHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        const compressedProgress = await Promise.all(progressFiles.map((f) => compressImageFileForUpload(f)))
        const profilePrepared = profileFile ? await compressImageFileForUpload(profileFile) : null
        const medicalPrepared = medicalFile && medicalFile.type.startsWith('image/')
          ? await compressImageFileForUpload(medicalFile)
          : medicalFile

        const formData = new FormData()
        formData.append('payload', JSON.stringify(payload))
        for (const f of compressedProgress) formData.append('progress', f)
        if (profilePrepared) formData.append('profile', profilePrepared)
        if (medicalPrepared) formData.append('medical', medicalPrepared)
        res = await fetch(endpoint, { method: 'POST', headers: fnHeaders, body: formData })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconocido'
      toast.error(`No se pudo conectar (${msg}). Recargá e intentá de nuevo.`)
      return
    }

    const rawText = await res.text()
    let body: { ok?: boolean; error?: string }
    try {
      body = JSON.parse(rawText) as { ok?: boolean; error?: string }
    } catch {
      toast.error(res.status === 413 ? 'Los archivos pesan demasiado.' : `Error del servidor (${res.status}).`)
      return
    }
    if (!res.ok || body.error) { toast.error(body.error || 'Error al enviar'); return }
    if (!body.ok) { toast.error('No se pudo completar el registro'); return }
    toast.success('¡Listo!')
    onSuccess()
  }

  return (
    <div ref={scrollRef} className="max-w-md mx-auto lg:mx-0">
      <h1 className="text-xl font-bold text-ink-primary tracking-tight mb-0.5">
        Registro Plan Full
      </h1>
      <p className="text-xs text-ink-secondary mb-2">
        Entrenamiento + nutrición · Haciéndolo hábito
      </p>
      <p className="text-[11px] text-ink-muted mb-2.5">
        Tomás Ferster · Cristian Crossetto
      </p>

      {/* Plan badge */}
      {selectedPlanLabel ? (
        <div className={intakePublicSelectedPlanBarClass}>
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600 dark:text-white/55">
            Plan
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight text-ink-primary">
            {selectedPlanLabel}
          </span>
          {selectedPlanPrice && (
            <span className="shrink-0 text-[15px] font-bold tabular-nums text-ink-primary">{selectedPlanPrice}</span>
          )}
        </div>
      ) : (
        <div className="mb-3 rounded-lg border-l-2 border-status-expiring bg-status-expiring/8 px-2.5 py-2">
          <p className="text-[11px] leading-snug text-ink-secondary">Elegí un plan en el panel izquierdo.</p>
        </div>
      )}

      {/* Step tabs */}
      <div className="mb-1.5 flex gap-0.5">
        {STEP_TITLES.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'flex-1 rounded-md px-0.5 py-1.5 text-[9px] sm:text-[10px] font-semibold transition-colors text-center leading-none',
              step === i
                ? 'bg-zinc-600 text-white shadow-[inset_0_-2px_0_0_rgb(63_63_70)] dark:bg-zinc-500 dark:shadow-[inset_0_-2px_0_0_rgb(82_82_91)]'
                : 'bg-surface-elevated text-ink-muted hover:text-ink-secondary',
            )}
          >
            {i + 1}. {t}
          </button>
        ))}
      </div>
      <div className="mb-4 flex items-center gap-2">
        <div
          className="h-0.5 min-h-[2px] flex-1 overflow-hidden rounded-full bg-surface-border/80 dark:bg-zinc-700/80"
          role="progressbar"
          aria-valuenow={Math.round(((step + 1) / STEP_TITLES.length) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso del formulario"
        >
          <div
            className="h-full rounded-full bg-brand-primary transition-[width] duration-500 ease-out"
            style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-[8px] font-semibold tabular-nums leading-none text-brand-primary sm:text-[9px]">
          {Math.round(((step + 1) / STEP_TITLES.length) * 100)}%
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

        {/* ── PASO 0: Datos personales ── */}
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-4">
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
              <FieldLabel required>Documento</FieldLabel>
              <input type="text" className={inputClass(errors.document_id?.message)} {...register('document_id')} />
              {errors.document_id?.message && <p className="mt-1 text-xs text-status-expired">{errors.document_id.message}</p>}
            </div>
            <div>
              <FieldLabel required>Teléfono</FieldLabel>
              <input type="tel" autoComplete="tel" className={inputClass(errors.phone?.message)}
                {...register('phone', {
                  onBlur: (e) => {
                    const formatted = formatArgPhoneInput(e.target.value)
                    if (formatted !== e.target.value) setValue('phone', formatted, { shouldValidate: true })
                  },
                })} />
              {errors.phone?.message ? <p className="mt-1 text-xs text-status-expired">{errors.phone.message}</p> : <p className="mt-1 text-[11px] text-ink-muted">{PHONE_HINT}</p>}
            </div>
            <div>
              <FieldLabel required>Fecha de nacimiento</FieldLabel>
              <input type="date" className={inputClass(errors.birth_date?.message)} {...register('birth_date')} />
              {errors.birth_date?.message && <p className="mt-1 text-xs text-status-expired">{errors.birth_date.message}</p>}
            </div>
            <div>
              <FieldLabel required>Género</FieldLabel>
              <div className="space-y-2">
                {(['M', 'F', 'otro'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                    <input type="radio" value={v} className="accent-zinc-600 dark:accent-zinc-500" {...register('gender')} />
                    {v === 'M' ? 'Masculino' : v === 'F' ? 'Femenino' : 'Otros'}
                  </label>
                ))}
              </div>
              {gender === 'otro' && (
                <div className="mt-2">
                  <input type="text" placeholder="Especificar" className={inputClass(errors.gender_other?.message)} {...register('gender_other')} />
                  {errors.gender_other?.message && <p className="mt-1 text-xs text-status-expired">{errors.gender_other.message}</p>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Peso (kg)</FieldLabel>
                <input type="number" step="0.1" className={inputClass(errors.weight_kg?.message)} {...register('weight_kg', { valueAsNumber: true })} />
                {errors.weight_kg?.message && <p className="mt-1 text-xs text-status-expired">{String(errors.weight_kg.message)}</p>}
              </div>
              <div>
                <FieldLabel required>Altura (cm)</FieldLabel>
                <input type="number" className={inputClass(errors.height_cm?.message)} {...register('height_cm', { valueAsNumber: true })} />
                {errors.height_cm?.message && <p className="mt-1 text-xs text-status-expired">{String(errors.height_cm.message)}</p>}
              </div>
            </div>
            <div>
              <FieldLabel required>Correo electrónico</FieldLabel>
              <input type="email" autoComplete="email" className={inputClass(errors.email?.message)} {...register('email')} />
              {errors.email?.message && <p className="mt-1 text-xs text-status-expired">{errors.email.message}</p>}
            </div>
            <div>
              <FieldLabel required>Dirección completa</FieldLabel>
              <textarea rows={2} className={cn(inputClass(errors.address?.message), 'resize-y min-h-[72px]')} {...register('address')} />
              {errors.address?.message && <p className="mt-1 text-xs text-status-expired">{errors.address.message}</p>}
            </div>
          </>
        )}

        {/* ── PASO 1: Entrenamiento (Tomás Ferster) ── */}
        {step === 1 && (
          <>
            <div className="mb-2 rounded-md border-l-2 border-brand-secondary/50 bg-brand-secondary/6 px-2.5 py-2">
              <p className="text-[11px] text-ink-secondary">
                Entrenamiento · <span className="font-semibold text-ink-primary">Tomás Ferster</span>
              </p>
            </div>
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
              <FieldLabel required>¿Algún ejercicio que te incomode o no puedas hacer?</FieldLabel>
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
            <div className="mb-2 rounded-md border-l-2 border-brand-secondary/50 bg-brand-secondary/6 px-2.5 py-2">
              <p className="text-[11px] text-ink-secondary">
                Nutrición · <span className="font-semibold text-ink-primary">Cristian Crossetto</span>
              </p>
            </div>
            <div>
              <FieldLabel>Motivo de consulta nutricional</FieldLabel>
              <textarea rows={3} className={cn(inputClass(), 'resize-y min-h-[88px]')} placeholder="¿Por qué buscás asesoramiento nutricional?" {...register('motivo_consulta')} />
            </div>
            <div>
              <FieldLabel>Patologías presentes</FieldLabel>
              <textarea rows={2} className={cn(inputClass(), 'resize-y min-h-[72px]')} placeholder="ej: hipotiroidismo, diabetes... o ninguna" {...register('pathologies')} />
            </div>
            <div>
              <FieldLabel>Medicación que tomás</FieldLabel>
              <textarea rows={2} className={cn(inputClass(), 'resize-y min-h-[72px]')} placeholder="Nombre y dosis, o ninguna" {...register('medications')} />
            </div>
            <div>
              <FieldLabel>Síntomas digestivos</FieldLabel>
              <textarea rows={2} className={cn(inputClass(), 'resize-y min-h-[72px]')} placeholder="Hinchazón, acidez, etc. o ninguno" {...register('symptoms')} />
            </div>
            <div>
              <FieldLabel>Intolerancias digestivas</FieldLabel>
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
            {/* Summary */}
            {(watchedFirstName || watchedEmail || watchedPhone) && (
              <div className="mb-2 space-y-1 rounded-lg border border-surface-border bg-surface-elevated/50 p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-muted">Revisión</p>
                {(watchedFirstName || watchedLastName) && (
                  <p className="text-xs text-ink-secondary">
                    <span className="text-ink-muted">Nombre · </span>
                    {[watchedFirstName, watchedLastName].filter(Boolean).join(' ')}
                  </p>
                )}
                {watchedEmail && (
                  <p className="truncate text-xs text-ink-secondary">
                    <span className="text-ink-muted">Email · </span>
                    {watchedEmail}
                  </p>
                )}
                {watchedPhone && (
                  <p className="text-xs text-ink-secondary">
                    <span className="text-ink-muted">Tel. · </span>
                    {watchedPhone}
                  </p>
                )}
                {selectedPlanLabel && (
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-secondary">
                    <span className="text-ink-muted">Plan · </span>
                    <span className="font-medium">{selectedPlanLabel}</span>
                    {selectedPlanPrice && (
                      <span className="ml-auto font-semibold tabular-nums text-ink-primary">
                        {selectedPlanPrice}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}

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

        {/* Navigation */}
        <div className="flex gap-2 pt-1">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-surface-elevated"
            >
              ← Atrás
            </button>
          ) : (
            <span className="w-16" />
          )}
          <div className="flex-1" />
          {step < STEP_FIELDS.length - 1 ? (
            <button type="button" onClick={() => void goNext()} className={intakeFormCtaButtonClass}>
              Siguiente →
            </button>
          ) : (
            <button type="submit" disabled={isSubmitting} className={cn(intakeFormCtaButtonClass, 'px-5')}>
              {isSubmitting ? 'Enviando…' : 'Enviar'}
            </button>
          )}
        </div>

        <p className="pt-1.5 text-center text-[10px] text-ink-muted">Plan Full · Haciéndolo hábito</p>
      </form>
    </div>
  )
}

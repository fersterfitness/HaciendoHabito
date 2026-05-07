import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { canonicalizeArgentinaStudentPhone, STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
import toast from 'react-hot-toast'
import { AlertCircle, ChevronLeft, ChevronRight, ImagePlus, User, Mail, Phone, Calendar, X } from 'lucide-react'
import {
  fersterIntakeSchema,
  fersterDefaults,
  type FersterIntakeFormValues,
} from '@/lib/intake/fersterIntakeSchema'
import { compressImageFileForUpload } from '@/lib/compressImageForUpload'

const ACCENT = '#ffcc33'
const MAX_BYTES = 10 * 1024 * 1024
const PHONE_HINT = `Formato: ${STUDENT_PHONE_FORMAT_HINT}`

/**
 * Formatea un número argentino al formato canónico "+54 [área] [número]"
 * sin importar si el usuario escribió todo junto o sin el prefijo.
 *
 * Ejemplos:
 *   "541159059170"  → "+54 11 59059170"
 *   "01159059170"   → "+54 11 59059170"
 *   "1159059170"    → "+54 11 59059170"
 *   "+5411..."      → "+54 11 ..."
 *   "+54 11 ..."    → sin cambios (normaliza espacios extras)
 */
function formatArgPhoneInput(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (!trimmed) return trimmed

  // Si ya tiene + Y espacios, está bien formateado → lo dejamos
  if (trimmed.startsWith('+') && trimmed.includes(' ')) {
    return trimmed
  }

  // En cualquier otro caso (con o sin +, con o sin espacios) extraemos solo dígitos
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed

  let rest = digits
  if (digits.startsWith('54')) {
    rest = digits.slice(2)
  } else if (digits.startsWith('0')) {
    // formato viejo: 011... → quitar el 0 inicial
    rest = digits.slice(1)
  }

  if (!rest) return '+54'
  if (rest.length <= 2) return `+54 ${rest}`
  const area = rest.slice(0, 2)
  const local = rest.slice(2)
  return `+54 ${area} ${local}`
}

const intakeSecret =
  typeof import.meta.env.VITE_PUBLIC_INTAKE_SECRET === 'string'
    ? import.meta.env.VITE_PUBLIC_INTAKE_SECRET
    : ''

const STEP_FIELDS: (keyof FersterIntakeFormValues)[][] = [
  [
    'first_name',
    'last_name',
    'document_id',
    'phone',
    'birth_date',
    'gender',
    'gender_other',
    'weight_kg',
    'height_cm',
    'email',
    'address',
  ],
  [
    'training_since',
    'days_per_week',
    'lifestyle',
    'training_intensity',
    'session_duration',
    'equipment',
    'main_goal',
  ],
  [
    'pathology',
    'pathology_detail',
    'discomfort_exercises',
    'four_meals',
    'sleep_hours',
    'supplements',
  ],
  ['accept_privacy'],
]

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-ink-secondary mb-1.5">
      {children}
      {required ? <span style={{ color: ACCENT }}>*</span> : null}
    </label>
  )
}

const inputClass = (err?: string) =>
  cn(
    'w-full rounded-xl border px-4 py-3 text-sm transition-shadow',
    'bg-surface-input border-surface-inputBorder text-ink-primary placeholder:text-ink-muted',
    'focus:outline-none focus:ring-2 focus:ring-[#ffcc33]/55 focus:border-transparent',
    err && 'border-status-expired focus:ring-status-expired/35',
  )

function checkFileSize(f: File): boolean {
  if (f.size > MAX_BYTES) {
    toast.error(`${f.name}: máximo 10 MB`)
    return false
  }
  return true
}

type Props = {
  onSuccess: () => void
  selectedPlanSlug?: string | null
  selectedPlanLabel?: string | null
  selectedPlanPrice?: string | null
}

export function IntakeFersterForm({ onSuccess, selectedPlanSlug = null, selectedPlanLabel = null, selectedPlanPrice = null }: Props) {
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
  } = useForm<FersterIntakeFormValues>({
    resolver: zodResolver(fersterIntakeSchema),
    defaultValues: fersterDefaults() as FersterIntakeFormValues,
  })

  const pathology = watch('pathology')
  const gender = watch('gender')
  const watchedFirstName = watch('first_name')
  const watchedLastName = watch('last_name')
  const watchedEmail = watch('email')
  const watchedPhone = watch('phone')

  // scroll to top of form on step change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    const parent = scrollRef.current?.closest('.overflow-y-auto')
    if (parent) parent.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  // cleanup object URLs
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
    const ok = await trigger(fields, { shouldFocus: true })
    if (ok) setStep((s) => Math.min(s + 1, STEP_FIELDS.length - 1))
  }

  async function onSubmit(values: FersterIntakeFormValues) {
    const phone = canonicalizeArgentinaStudentPhone(values.phone)
    if (!phone) return

    const filesToCheck = [...progressFiles, ...(profileFile ? [profileFile] : []), ...(medicalFile ? [medicalFile] : [])]
    for (const f of filesToCheck) {
      if (!checkFileSize(f)) return
    }

    if (progressFiles.length > 5) {
      toast.error('Como máximo 5 fotos corporales.')
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    if (!supabaseUrl || !anon) {
      toast.error('Falta configuración del sitio')
      return
    }

    const payload = {
      ...values,
      phone,
      selected_plan_slug: selectedPlanSlug,
      website: '',
    }

    /**
     * Siempre llamamos directo a la Edge Function de Supabase. El proxy `/api/intake` en Vercel
     * intermediaba multipart y suele hacer **504** (timeout ~10 s en Hobby) porque suma tiempo de proxy + uploads.
     * Con JWT desactivado y CORS en la función, el navegador puede postear cross-origin bien.
     */
    const endpoint = `${supabaseUrl}/functions/v1/public-intake-form`
    const fnHeaders: Record<string, string> = {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    }
    if (intakeSecret) fnHeaders['x-intake-secret'] = intakeSecret

    const hasFiles = progressFiles.length > 0 || profileFile !== null || medicalFile !== null

    let res: Response
    try {
      if (!hasFiles) {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            ...fnHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
      } else {
        const compressedProgress = await Promise.all(
          progressFiles.map((f) => compressImageFileForUpload(f)),
        )
        const profilePrepared = profileFile ? await compressImageFileForUpload(profileFile) : null
        const medicalPrepared =
          medicalFile && medicalFile.type.startsWith('image/')
            ? await compressImageFileForUpload(medicalFile)
            : medicalFile

        const formData = new FormData()
        formData.append('payload', JSON.stringify(payload))
        for (const f of compressedProgress) {
          formData.append('progress', f)
        }
        if (profilePrepared) formData.append('profile', profilePrepared)
        if (medicalPrepared) formData.append('medical', medicalPrepared)
        res = await fetch(endpoint, {
          method: 'POST',
          headers: fnHeaders,
          body: formData,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconocido'
      console.error('[intake] fetch failed', err, { endpoint })
      toast.error(`No se pudo conectar (${msg}). Si seguís el problema, recargá la página.`)
      return
    }

    const rawText = await res.text()
    let body: { ok?: boolean; error?: string }
    try {
      body = JSON.parse(rawText) as { ok?: boolean; error?: string }
    } catch {
      toast.error(
        res.status === 413
          ? 'Los archivos pesan demasiado. Probá fotos más chicas.'
          : res.status === 504
            ? 'El envío tardó demasiado. Probá con fotos más chicas o sin adjuntos para probar.'
            : `El servidor no respondió bien (${res.status}). Si adjuntaste fotos, probá reducir su tamaño.`,
      )
      return
    }

    if (!res.ok || body.error) {
      toast.error(body.error || 'Error al enviar')
      return
    }
    if (!body.ok) {
      toast.error('No se pudo completar el registro')
      return
    }

    toast.success('¡Listo!')
    onSuccess()
  }

  const stepTitles = ['Tus datos', 'Entrenamiento', 'Salud y hábitos', 'Fotos y envío']

  return (
    <div ref={scrollRef} className="max-w-md mx-auto lg:mx-0">
      <h1 className="text-2xl sm:text-[1.65rem] font-bold text-ink-primary tracking-tight mb-1">
        Formulario de registro
      </h1>
      <p className="text-sm text-ink-secondary mb-2">
        Plan personalizado — <span className="font-medium">Haciéndolo hábito</span>
      </p>
      <p className="text-xs text-ink-muted mb-4">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium hover:underline" style={{ color: ACCENT }}>
          Iniciar sesión
        </Link>
      </p>

      {/* Plan badge / no-plan nudge */}
      {selectedPlanLabel ? (
        <div
          className="mb-4 flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
          style={{ borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}12` }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>Plan elegido</span>
          <span className="text-sm font-semibold text-ink-primary truncate">{selectedPlanLabel}</span>
          {selectedPlanPrice ? (
            <span className="ml-auto shrink-0 text-sm font-bold" style={{ color: ACCENT }}>{selectedPlanPrice}</span>
          ) : null}
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-expiring/40 bg-status-expiring/8 px-3 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-status-expiring" />
          <p className="text-xs text-ink-secondary">
            Seleccioná un plan en el panel izquierdo antes de continuar.
          </p>
        </div>
      )}

      {/* Step tabs */}
      <div className="flex gap-1 mb-2">
        {stepTitles.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'flex-1 rounded-lg py-2 px-1 text-[10px] sm:text-xs font-semibold transition-colors text-center leading-tight',
              step === i ? 'text-white shadow-sm' : 'bg-surface-elevated text-ink-muted hover:text-ink-secondary',
            )}
            style={step === i ? { backgroundColor: ACCENT } : undefined}
          >
            {i + 1}. {t}
          </button>
        ))}
      </div>
      {/* Progress bar */}
      <div className="mb-5 h-1 rounded-full bg-surface-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${((step + 1) / stepTitles.length) * 100}%`, backgroundColor: ACCENT }}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Nombre</FieldLabel>
                <input
                  type="text"
                  autoComplete="given-name"
                  className={inputClass(errors.first_name?.message)}
                  {...register('first_name')}
                />
                {errors.first_name?.message ? (
                  <p className="mt-1 text-xs text-status-expired">{errors.first_name.message}</p>
                ) : null}
              </div>
              <div>
                <FieldLabel required>Apellido</FieldLabel>
                <input
                  type="text"
                  autoComplete="family-name"
                  className={inputClass(errors.last_name?.message)}
                  {...register('last_name')}
                />
                {errors.last_name?.message ? (
                  <p className="mt-1 text-xs text-status-expired">{errors.last_name.message}</p>
                ) : null}
              </div>
            </div>
            <div>
              <FieldLabel required>Documento</FieldLabel>
              <input type="text" className={inputClass(errors.document_id?.message)} {...register('document_id')} />
              {errors.document_id?.message ? (
                <p className="mt-1 text-xs text-status-expired">{errors.document_id.message}</p>
              ) : null}
            </div>
            <div>
              <FieldLabel required>Teléfono</FieldLabel>
              <input
                type="tel"
                autoComplete="tel"
                className={inputClass(errors.phone?.message)}
                {...register('phone', {
                  onBlur: (e) => {
                    const formatted = formatArgPhoneInput(e.target.value)
                    if (formatted !== e.target.value) {
                      setValue('phone', formatted, { shouldValidate: true })
                    }
                  },
                })}
              />
              {errors.phone?.message ? (
                <p className="mt-1 text-xs text-status-expired">{errors.phone.message}</p>
              ) : (
                <p className="mt-1 text-[11px] text-ink-muted">{PHONE_HINT}</p>
              )}
            </div>
            <div>
              <FieldLabel required>Fecha de nacimiento</FieldLabel>
              <input type="date" className={inputClass(errors.birth_date?.message)} {...register('birth_date')} />
              {errors.birth_date?.message ? (
                <p className="mt-1 text-xs text-status-expired">{errors.birth_date.message}</p>
              ) : null}
            </div>
            <div>
              <FieldLabel required>Género</FieldLabel>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                  <input type="radio" value="M" className="accent-[#ffcc33]" {...register('gender')} />
                  Masculino
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                  <input type="radio" value="F" className="accent-[#ffcc33]" {...register('gender')} />
                  Femenino
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                  <input type="radio" value="otro" className="accent-[#ffcc33]" {...register('gender')} />
                  Otros
                </label>
              </div>
              {gender === 'otro' ? (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Especificar"
                    className={inputClass(errors.gender_other?.message)}
                    {...register('gender_other')}
                  />
                  {errors.gender_other?.message ? (
                    <p className="mt-1 text-xs text-status-expired">{errors.gender_other.message}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Peso (kg)</FieldLabel>
                <input
                  type="number"
                  step="0.1"
                  className={inputClass(errors.weight_kg?.message)}
                  {...register('weight_kg', { valueAsNumber: true })}
                />
                {errors.weight_kg?.message ? (
                  <p className="mt-1 text-xs text-status-expired">{String(errors.weight_kg.message)}</p>
                ) : null}
              </div>
              <div>
                <FieldLabel required>Altura (cm)</FieldLabel>
                <input
                  type="number"
                  className={inputClass(errors.height_cm?.message)}
                  {...register('height_cm', { valueAsNumber: true })}
                />
                {errors.height_cm?.message ? (
                  <p className="mt-1 text-xs text-status-expired">{String(errors.height_cm.message)}</p>
                ) : null}
              </div>
            </div>
            <div>
              <FieldLabel required>Correo electrónico</FieldLabel>
              <input type="email" autoComplete="email" className={inputClass(errors.email?.message)} {...register('email')} />
              {errors.email?.message ? <p className="mt-1 text-xs text-status-expired">{errors.email.message}</p> : null}
            </div>
            <div>
              <FieldLabel required>Dirección completa</FieldLabel>
              <textarea rows={2} className={cn(inputClass(errors.address?.message), 'resize-y min-h-[72px]')} {...register('address')} />
              {errors.address?.message ? <p className="mt-1 text-xs text-status-expired">{errors.address.message}</p> : null}
            </div>
          </>
        )}

        {step === 1 && (
          <>
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
                  <option key={n} value={n}>
                    {n} x semana
                  </option>
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

        {step === 2 && (
          <>
            <div>
              <FieldLabel required>¿Patología o medicamentos?</FieldLabel>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="no" className="accent-[#ffcc33]" {...register('pathology')} />
                  No
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="yes" className="accent-[#ffcc33]" {...register('pathology')} />
                  Sí (detallar abajo y adjuntar estudios en el último paso)
                </label>
              </div>
            </div>
            {pathology === 'yes' ? (
              <div>
                <FieldLabel required>Detalle</FieldLabel>
                <textarea
                  rows={3}
                  className={cn(inputClass(errors.pathology_detail?.message), 'resize-y min-h-[88px]')}
                  {...register('pathology_detail')}
                />
                {errors.pathology_detail?.message ? (
                  <p className="mt-1 text-xs text-status-expired">{errors.pathology_detail.message}</p>
                ) : null}
              </div>
            ) : null}
            <div>
              <FieldLabel required>¿Algún ejercicio que te incomode o no puedas hacer?</FieldLabel>
              <textarea
                rows={2}
                className={cn(inputClass(errors.discomfort_exercises?.message), 'resize-y min-h-[72px]')}
                placeholder="Ej.: Ninguno / evito impacto en rodilla…"
                {...register('discomfort_exercises')}
              />
              {errors.discomfort_exercises?.message ? (
                <p className="mt-1 text-xs text-status-expired">{errors.discomfort_exercises.message}</p>
              ) : null}
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
                  <input type="radio" value="no" className="accent-[#ffcc33]" {...register('supplements')} />
                  No
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="yes" className="accent-[#ffcc33]" {...register('supplements')} />
                  Sí
                </label>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            {/* Summary card */}
            {(watchedFirstName || watchedEmail || watchedPhone) && (
              <div className="mb-2 rounded-xl border border-surface-border bg-surface-elevated/60 p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-ink-muted font-semibold mb-2">Revisá tus datos</p>
                {(watchedFirstName || watchedLastName) && (
                  <div className="flex items-center gap-2 text-sm text-ink-secondary">
                    <User className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    <span>{[watchedFirstName, watchedLastName].filter(Boolean).join(' ')}</span>
                  </div>
                )}
                {watchedEmail && (
                  <div className="flex items-center gap-2 text-sm text-ink-secondary">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    <span className="truncate">{watchedEmail}</span>
                  </div>
                )}
                {watchedPhone && (
                  <div className="flex items-center gap-2 text-sm text-ink-secondary">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    <span>{watchedPhone}</span>
                  </div>
                )}
                {selectedPlanLabel && (
                  <div className="flex items-center gap-2 text-sm text-ink-secondary">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    <span>{selectedPlanLabel}</span>
                    {selectedPlanPrice ? <span className="ml-auto font-semibold" style={{ color: ACCENT }}>{selectedPlanPrice}</span> : null}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-ink-secondary leading-relaxed">
              Las fotos y estudios son <span className="font-medium">opcionales</span>. Imágenes claras
              (frontal, lateral, espalda, hasta 5, máx. 10 MB c/u).
            </p>

            {/* Medical file */}
            <div>
              <FieldLabel>Estudios médicos (PDF o imagen, opcional)</FieldLabel>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-surface-border bg-surface-elevated/40 px-4 py-3 transition-colors hover:border-[#ffcc33]/50 hover:bg-[#ffcc33]/5">
                <ImagePlus className="h-5 w-5 shrink-0 text-ink-muted" />
                <span className="text-sm text-ink-secondary truncate">
                  {medicalFile ? medicalFile.name : 'Elegir archivo…'}
                </span>
                {medicalFile && (
                  <button
                    type="button"
                    className="ml-auto shrink-0 rounded-full p-0.5 hover:bg-surface-border/50"
                    onClick={(e) => { e.preventDefault(); setMedicalFile(null) }}
                  >
                    <X className="h-3.5 w-3.5 text-ink-muted" />
                  </button>
                )}
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="sr-only"
                  onChange={(e) => setMedicalFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {/* Progress photos */}
            <div>
              <FieldLabel>Fotografías análisis (opcional, hasta 5)</FieldLabel>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-surface-border bg-surface-elevated/40 px-4 py-3 transition-colors hover:border-[#ffcc33]/50 hover:bg-[#ffcc33]/5">
                <ImagePlus className="h-5 w-5 shrink-0 text-ink-muted" />
                <span className="text-sm text-ink-secondary">
                  {progressFiles.length > 0 ? `${progressFiles.length} foto(s) elegida(s)` : 'Elegir fotos…'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleProgressFiles(e.target.files)}
                />
              </label>
              {progressPreviews.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {progressPreviews.map((src, idx) => (
                    <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border border-surface-border">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5"
                        onClick={() => {
                          const next = progressFiles.filter((_, i) => i !== idx)
                          URL.revokeObjectURL(src)
                          setProgressFiles(next)
                          setProgressPreviews((p) => p.filter((_, i) => i !== idx))
                        }}
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profile photo */}
            <div>
              <FieldLabel>Foto para registro visual (opcional)</FieldLabel>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-surface-border bg-surface-elevated/40 px-4 py-3 transition-colors hover:border-[#ffcc33]/50 hover:bg-[#ffcc33]/5">
                {profilePreview ? (
                  <img src={profilePreview} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <ImagePlus className="h-5 w-5 shrink-0 text-ink-muted" />
                )}
                <span className="text-sm text-ink-secondary truncate">
                  {profileFile ? profileFile.name : 'Elegir foto…'}
                </span>
                {profileFile && (
                  <button
                    type="button"
                    className="ml-auto shrink-0 rounded-full p-0.5 hover:bg-surface-border/50"
                    onClick={(e) => { e.preventDefault(); handleProfileFile(null) }}
                  >
                    <X className="h-3.5 w-3.5 text-ink-muted" />
                  </button>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => handleProfileFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-surface-border bg-surface-input focus:ring-2 focus:ring-offset-0 focus:ring-offset-surface-card"
                style={{ accentColor: ACCENT }}
                {...register('accept_privacy')}
              />
              <span className="text-sm text-ink-secondary leading-snug">
                Acepto el envío de mis datos y archivos según la política del estudio. Entiendo que las fotos y datos se
                usan para el plan personalizado.
              </span>
            </label>
            {errors.accept_privacy?.message ? (
              <p className="text-xs text-status-expired">{errors.accept_privacy.message}</p>
            ) : null}
            <input type="text" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden {...register('website')} />
          </>
        )}

        <div className="flex gap-3 pt-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-surface-border px-4 py-3 text-sm font-medium text-ink-secondary hover:bg-surface-elevated"
            >
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </button>
          ) : (
            <span className="w-24" />
          )}
          <div className="flex-1" />
          {step < STEP_FIELDS.length - 1 ? (
            <button
              type="button"
              onClick={() => void goNext()}
              className="inline-flex items-center justify-center gap-1 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg"
              style={{ backgroundColor: ACCENT, boxShadow: `0 8px 24px -4px ${ACCENT}66` }}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
              style={{ backgroundColor: ACCENT, boxShadow: `0 8px 24px -4px ${ACCENT}66` }}
            >
              {isSubmitting ? 'Enviando…' : 'Enviar registro'}
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-ink-muted pt-2">Ferster Fitness · Haciéndolo hábito</p>
      </form>
    </div>
  )
}

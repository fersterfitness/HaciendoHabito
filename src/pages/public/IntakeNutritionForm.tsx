import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { canonicalizeArgentinaStudentPhone, STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  nutritionIntakeSchema,
  nutritionDefaults,
  FOOD_ITEMS,
  type NutritionIntakeFormValues,
} from '@/lib/intake/nutritionIntakeSchema'
import { compressImageFileForUpload } from '@/lib/compressImageForUpload'

const ACCENT = '#ffcc33'
const MAX_BYTES = 10 * 1024 * 1024
const PHONE_HINT = `Formato: ${STUDENT_PHONE_FORMAT_HINT}`

const intakeSecret =
  typeof import.meta.env.VITE_PUBLIC_INTAKE_SECRET === 'string'
    ? import.meta.env.VITE_PUBLIC_INTAKE_SECRET
    : ''

// Campos requeridos por paso (los opcionales no se validan al avanzar)
const STEP_FIELDS: (keyof NutritionIntakeFormValues)[][] = [
  ['first_name', 'last_name', 'birth_date', 'email', 'phone'],
  ['weight_kg', 'height_cm'],
  [],
  [],
  ['accept_privacy'],
]

const STEP_TITLES = [
  'Datos personales',
  'Salud',
  'Actividad y hábitos',
  'Registro 24hs',
  'Frecuencia y hábitos',
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

const taClass = (err?: string) =>
  cn(inputClass(err), 'resize-y min-h-[88px]')

const FREQ_OPTIONS = ['', 'Diario', 'Semanal', 'Quincenal', 'Mensual', 'X']

type Props = { onSuccess: () => void }

export function IntakeNutritionForm({ onSuccess }: Props) {
  const [step, setStep] = useState(0)
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [labFile, setLabFile] = useState<File | null>(null)

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

  async function goNext() {
    const fields = STEP_FIELDS[step]
    const ok = await trigger(fields.length ? fields : undefined, { shouldFocus: true })
    if (ok) setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1))
  }

  async function onSubmit(values: NutritionIntakeFormValues) {
    const phone = canonicalizeArgentinaStudentPhone(values.phone)
    if (!phone) return

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    if (!supabaseUrl || !anon) { toast.error('Falta configuración del sitio'); return }

    const payload = { ...values, phone, form_type: 'nutrition', website: '' }
    const endpoint = `${supabaseUrl}/functions/v1/public-intake-form`
    const fnHeaders: Record<string, string> = {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    }
    if (intakeSecret) fnHeaders['x-intake-secret'] = intakeSecret

    let res: Response
    try {
      const hasFiles = profileFile !== null || labFile !== null
      if (!hasFiles) {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { ...fnHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        const profilePrepared = profileFile ? await compressImageFileForUpload(profileFile) : null
        const labPrepared =
          labFile && labFile.type.startsWith('image/')
            ? await compressImageFileForUpload(labFile)
            : labFile

        const formData = new FormData()
        formData.append('payload', JSON.stringify(payload))
        if (profilePrepared) formData.append('profile', profilePrepared)
        if (labPrepared) formData.append('medical', labPrepared)
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
      toast.error(
        res.status === 413
          ? 'Los archivos pesan demasiado.'
          : `Error del servidor (${res.status}).`,
      )
      return
    }
    if (!res.ok || body.error) { toast.error(body.error || 'Error al enviar'); return }
    if (!body.ok) { toast.error('No se pudo completar el registro'); return }
    toast.success('¡Listo!')
    onSuccess()
  }

  return (
    <div className="max-w-md mx-auto lg:mx-0">
      <h1 className="text-2xl sm:text-[1.65rem] font-bold text-ink-primary tracking-tight mb-1">
        Cuestionario nutricional
      </h1>
      <p className="text-sm text-ink-secondary mb-2">
        Plan personalizado de alimentación — <span className="font-medium">Haciéndolo hábito</span>
      </p>
      <p className="text-xs text-ink-muted mb-6">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium hover:underline" style={{ color: ACCENT }}>
          Iniciar sesión
        </Link>
      </p>

      {/* Barra de pasos */}
      <div className="flex gap-1 mb-6">
        {STEP_TITLES.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'flex-1 rounded-lg py-2 px-1 text-[10px] sm:text-[11px] font-semibold transition-colors text-center leading-tight',
              step === i ? 'text-white shadow-sm' : 'bg-surface-elevated text-ink-muted hover:text-ink-secondary',
            )}
            style={step === i ? { backgroundColor: ACCENT } : undefined}
          >
            {i + 1}. {t}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* ── Paso 0: Datos personales ─────────────────────────────────────── */}
        {step === 0 && (
          <>
            <div>
              <FieldLabel>Motivo de consulta</FieldLabel>
              <textarea rows={3} className={taClass()} placeholder="¿Por qué buscás asesoramiento nutricional?" {...register('motivo_consulta')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Nombre</FieldLabel>
                <input type="text" autoComplete="given-name" className={inputClass(errors.first_name?.message)} {...register('first_name')} />
                {errors.first_name?.message && <p className="mt-1 text-xs text-red-400">{errors.first_name.message}</p>}
              </div>
              <div>
                <FieldLabel required>Apellido</FieldLabel>
                <input type="text" autoComplete="family-name" className={inputClass(errors.last_name?.message)} {...register('last_name')} />
                {errors.last_name?.message && <p className="mt-1 text-xs text-red-400">{errors.last_name.message}</p>}
              </div>
            </div>

            <div>
              <FieldLabel required>Fecha de nacimiento</FieldLabel>
              <input type="date" className={inputClass(errors.birth_date?.message)} {...register('birth_date')} />
              {errors.birth_date?.message && <p className="mt-1 text-xs text-red-400">{errors.birth_date.message}</p>}
            </div>

            <div>
              <FieldLabel required>Correo electrónico</FieldLabel>
              <input type="email" autoComplete="email" className={inputClass(errors.email?.message)} {...register('email')} />
              {errors.email?.message && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div>
              <FieldLabel required>Teléfono</FieldLabel>
              <input
                type="tel"
                autoComplete="tel"
                className={inputClass(errors.phone?.message)}
                {...register('phone', {
                  onBlur: (e) => {
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
              {errors.phone?.message
                ? <p className="mt-1 text-xs text-red-400">{errors.phone.message}</p>
                : <p className="mt-1 text-[11px] text-ink-muted">{PHONE_HINT}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Profesión / Ocupación</FieldLabel>
                <input type="text" className={inputClass()} placeholder="ej: docente" {...register('profession')} />
              </div>
              <div>
                <FieldLabel>Horario de trabajo</FieldLabel>
                <input type="text" className={inputClass()} placeholder="ej: 8 a 17hs" {...register('work_hours')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
          </>
        )}

        {/* ── Paso 1: Salud y antropometría ────────────────────────────────── */}
        {step === 1 && (
          <>
            <p className="text-xs text-ink-muted leading-relaxed bg-surface-elevated rounded-xl px-4 py-3">
              Las medidas de cintura, cadera y brazo las tomará el profesional en la consulta. Solo completá peso y altura.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Peso actual (kg)</FieldLabel>
                <input type="number" step="0.1" className={inputClass(errors.weight_kg?.message)}
                  {...register('weight_kg', { valueAsNumber: true })} />
                {errors.weight_kg?.message && <p className="mt-1 text-xs text-red-400">{String(errors.weight_kg.message)}</p>}
              </div>
              <div>
                <FieldLabel required>Altura (cm)</FieldLabel>
                <input type="number" className={inputClass(errors.height_cm?.message)}
                  {...register('height_cm', { valueAsNumber: true })} />
                {errors.height_cm?.message && <p className="mt-1 text-xs text-red-400">{String(errors.height_cm.message)}</p>}
              </div>
            </div>

            <div>
              <FieldLabel>Patologías presentes</FieldLabel>
              <textarea rows={2} className={taClass()} placeholder="ej: hipotiroidismo, diabetes... o ninguna" {...register('pathologies')} />
            </div>
            <div>
              <FieldLabel>Medicación que tomás</FieldLabel>
              <textarea rows={2} className={taClass()} placeholder="Nombre y dosis, o ninguna" {...register('medications')} />
            </div>
            <div>
              <FieldLabel>Suplementación</FieldLabel>
              <input type="text" className={inputClass()} placeholder="ej: proteína en polvo, creatina... o ninguna" {...register('supplementation')} />
            </div>
            <div>
              <FieldLabel>Síntomas presentes</FieldLabel>
              <textarea rows={2} className={taClass()} placeholder="Síntomas digestivos, hinchazón, acidez, etc." {...register('symptoms')} />
            </div>
            <div>
              <FieldLabel>Antecedentes familiares</FieldLabel>
              <textarea rows={2} className={taClass()} placeholder="Diabetes, obesidad, hipotiroidismo, colesterol alto, etc." {...register('family_history')} />
            </div>

            <div>
              <FieldLabel>Tabaquismo</FieldLabel>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="no" className="accent-[#ffcc33]" {...register('smoking')} />
                  No
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="si" className="accent-[#ffcc33]" {...register('smoking')} />
                  Sí
                </label>
              </div>
            </div>

            <div>
              <FieldLabel>Análisis de laboratorio (PDF o imagen, opcional)</FieldLabel>
              <input
                type="file"
                accept=".pdf,image/*"
                className="text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-elevated file:px-3 file:py-2"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  if (f && f.size > MAX_BYTES) { toast.error('Máximo 10 MB'); return }
                  setLabFile(f)
                }}
              />
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
                  <input type="radio" value="no" className="accent-[#ffcc33]" {...register('has_physical_activity')} />
                  No
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value="si" className="accent-[#ffcc33]" {...register('has_physical_activity')} />
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
              <FieldLabel>Intolerancias digestivas</FieldLabel>
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
                <FieldLabel>{label}</FieldLabel>
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
                        className="w-full bg-surface-elevated text-ink-primary text-[11px] rounded-lg px-1.5 py-1.5 border border-surface-border focus:border-brand-primary outline-none cursor-pointer"
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
                        className="w-full bg-surface-elevated text-ink-primary text-[11px] rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
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
                  <p className="text-xs font-semibold text-red-400">Malos hábitos</p>
                  <input type="text" className={inputClass()} placeholder="Hábito malo 1" {...register('bad_habit_1')} />
                  <input type="text" className={inputClass()} placeholder="Hábito malo 2" {...register('bad_habit_2')} />
                  <input type="text" className={inputClass()} placeholder="Hábito malo 3" {...register('bad_habit_3')} />
                </div>
              </div>
            </div>

            {/* Foto para registro */}
            <div className="border-t border-surface-border pt-4">
              <FieldLabel>Foto de perfil para el registro (opcional)</FieldLabel>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-elevated file:px-3 file:py-2"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  if (f && f.size > MAX_BYTES) { toast.error('Máximo 10 MB'); return }
                  setProfileFile(f)
                }}
              />
            </div>

            {/* Privacidad */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-surface-border bg-surface-input focus:ring-2 focus:ring-offset-0 focus:ring-offset-surface-card"
                style={{ accentColor: ACCENT }}
                {...register('accept_privacy')}
              />
              <span className="text-sm text-ink-secondary leading-snug">
                Acepto el envío de mis datos según la política del estudio. Entiendo que se usarán para la elaboración de mi plan nutricional personalizado.
              </span>
            </label>
            {errors.accept_privacy?.message && (
              <p className="text-xs text-red-400">{errors.accept_privacy.message}</p>
            )}

            <input type="text" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden {...register('website')} />
          </>
        )}

        {/* ── Navegación ───────────────────────────────────────────────────── */}
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
          {step < STEP_TITLES.length - 1 ? (
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
              {isSubmitting ? 'Enviando…' : 'Enviar cuestionario'}
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-ink-muted pt-2">Haciéndolo hábito · Plan nutricional</p>
      </form>
    </div>
  )
}

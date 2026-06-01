import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { canonicalizeArgentinaStudentPhone, STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
import toast from 'react-hot-toast'
import {
  intakeFormFieldLabelClass,
  intakeFormInputClass,
  intakeFormPageContainerClass,
} from '@/lib/intake/intakeFormUi'
import { IntakeFormPlanHint } from '@/components/public/intake/IntakeFormPlanHint'
import { IntakePaymentPreferenceFields } from '@/components/public/IntakePaymentPreferenceFields'
import {
  psychologistIntakeSchema,
  psychologistDefaults,
  type PsychologistIntakeFormValues,
} from '@/lib/intake/psychologistIntakeSchema'
import { submitPublicIntake } from '@/lib/intake/submitPublicIntake'

const PHONE_HINT = `Formato: ${STUDENT_PHONE_FORMAT_HINT}`
const inputClass = intakeFormInputClass

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className={intakeFormFieldLabelClass()}>
      {children}
      {required ? <span className="text-zinc-500 dark:text-zinc-400">*</span> : null}
    </label>
  )
}

type Props = {
  onSuccess: () => void
  selectedPlanSlug?: string | null
  selectedPlanLabel?: string | null
  selectedPlanPrice?: string | null
  compact?: boolean
}

export function IntakePsychologistForm({
  onSuccess,
  selectedPlanSlug = null,
  selectedPlanLabel = null,
  selectedPlanPrice = null,
  compact = false,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PsychologistIntakeFormValues>({
    resolver: zodResolver(psychologistIntakeSchema),
    defaultValues: psychologistDefaults() as PsychologistIntakeFormValues,
  })

  async function onSubmit(values: PsychologistIntakeFormValues) {
    const phone = canonicalizeArgentinaStudentPhone(values.phone)
    if (!phone) return

    const result = await submitPublicIntake({
      ...values,
      phone,
      form_type: 'psychologist',
      selected_plan_slug: selectedPlanSlug,
      website: '',
    })

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
    <div className={intakeFormPageContainerClass()}>
      <IntakeFormPlanHint
        compact={compact}
        selectedPlanLabel={selectedPlanLabel}
        selectedPlanPrice={selectedPlanPrice}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Completá estos datos para que el equipo de psicología deportiva pueda contactarte.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel required>Nombre</FieldLabel>
            <input className={inputClass(errors.first_name)} {...register('first_name')} autoComplete="given-name" />
            {errors.first_name ? <p className="mt-1 text-xs text-red-600">{errors.first_name.message}</p> : null}
          </div>
          <div>
            <FieldLabel required>Apellido</FieldLabel>
            <input className={inputClass(errors.last_name)} {...register('last_name')} autoComplete="family-name" />
            {errors.last_name ? <p className="mt-1 text-xs text-red-600">{errors.last_name.message}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel required>Fecha de nacimiento</FieldLabel>
            <input type="date" className={inputClass(errors.birth_date)} {...register('birth_date')} />
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Para registrar tu edad.</p>
            {errors.birth_date ? <p className="mt-1 text-xs text-red-600">{errors.birth_date.message}</p> : null}
          </div>
          <div>
            <FieldLabel required>Email</FieldLabel>
            <input
              type="email"
              className={inputClass(errors.email)}
              {...register('email')}
              autoComplete="email"
            />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
          </div>
        </div>

        <div>
          <FieldLabel required>Teléfono de contacto</FieldLabel>
          <input
            type="tel"
            className={inputClass(errors.phone)}
            placeholder={PHONE_HINT}
            {...register('phone')}
            autoComplete="tel"
          />
          {errors.phone ? <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p> : null}
        </div>

        <div>
          <FieldLabel required>Lugar de residencia</FieldLabel>
          <input
            className={inputClass(errors.residence)}
            placeholder="Ciudad, barrio o localidad"
            {...register('residence')}
            autoComplete="address-level2"
          />
          {errors.residence ? <p className="mt-1 text-xs text-red-600">{errors.residence.message}</p> : null}
        </div>

        <div>
          <FieldLabel required>Deporte que practicás</FieldLabel>
          <input
            className={inputClass(errors.sport_practiced)}
            placeholder="Ej. fútbol, running, gym…"
            {...register('sport_practiced')}
          />
          {errors.sport_practiced ? (
            <p className="mt-1 text-xs text-red-600">{errors.sport_practiced.message}</p>
          ) : null}
        </div>

        <div>
          <FieldLabel required>Contacto de emergencia</FieldLabel>
          <textarea
            className={cn(inputClass(errors.emergency_contact), 'min-h-[72px] resize-y')}
            placeholder="Nombre completo y teléfono de la persona a contactar"
            {...register('emergency_contact')}
          />
          {errors.emergency_contact ? (
            <p className="mt-1 text-xs text-red-600">{errors.emergency_contact.message}</p>
          ) : null}
        </div>

        <IntakePaymentPreferenceFields register={register} errors={errors} />

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-primary/30"
            {...register('accept_privacy')}
          />
          <span>
            Acepto que mis datos se usen para el seguimiento profesional y las comunicaciones del servicio.
          </span>
        </label>
        {errors.accept_privacy ? (
          <p className="text-xs text-red-600">{errors.accept_privacy.message}</p>
        ) : null}

        <input type="text" className="hidden" tabIndex={-1} autoComplete="off" {...register('website')} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
        >
          {isSubmitting ? 'Enviando…' : 'Enviar datos'}
        </button>
      </form>
    </div>
  )
}
